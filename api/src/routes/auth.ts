import { Hono } from 'hono';

import { db } from '../clients.ts';
import type { AppEnv, Env } from '../env.ts';
import { invalid, noContent, readBody, requireUser, unauthorized } from '../http.ts';
import {
  accessExpiresAt,
  hashRefreshToken,
  issueAccessToken,
  newRefreshToken,
  readAccessToken,
  refreshExpiresAt,
  verifyGoogleIdToken,
} from '../tokens.ts';

/**
 * Sessions, issued and ended here.
 *
 * Google is asked once, at sign in, and only to prove who someone is. From
 * there this Worker mints its own pair: a short lived access token it signs,
 * and a long lived refresh token it stores the hash of. Nothing about a
 * session lives in an auth provider, which is what makes the provider
 * replaceable.
 *
 * Refresh rotates: using a refresh token spends it and hands back a new one,
 * so a stolen token stops working as soon as the real phone refreshes.
 */

type Session = { accessToken: string; refreshToken: string; expiresAt: number };

/** Mints a pair and records the refresh half against the account. */
async function startSession(env: Env, userId: string): Promise<Session | null> {
  const refreshToken = newRefreshToken();
  const expiresAt = accessExpiresAt();

  const { error } = await db(env)
    .from('refresh_tokens')
    .insert({
      token_hash: await hashRefreshToken(refreshToken),
      user_id: userId,
      expires_at: refreshExpiresAt().toISOString(),
    });
  if (error) {
    console.error('session', error);
    return null;
  }

  return {
    accessToken: await issueAccessToken(userId, env.JWT_SECRET, expiresAt),
    refreshToken,
    expiresAt,
  };
}

export const auth = new Hono<AppEnv>()
  /** A Google ID token from the device in, a session out. */
  .post('/google', async (c) => {
    const idToken = (await readBody(c))?.idToken;
    if (typeof idToken !== 'string') {
      return invalid(c);
    }

    const identity = await verifyGoogleIdToken(idToken, c.env.GOOGLE_CLIENT_ID);
    if (!identity) {
      return c.json({ error: 'sign_in_failed' }, 401);
    }

    /** Makes the account on a first sign in, and freshens it after. One statement. */
    const { data: userId, error } = await db(c.env).rpc('upsert_google_user', {
      p_sub: identity.sub,
      p_email: identity.email,
      p_name: identity.name,
      p_avatar: identity.picture,
    });
    if (error || typeof userId !== 'string') {
      console.error('sign in', error);
      return c.json({ error: 'sign_in_failed' }, 401);
    }

    const session = await startSession(c.env, userId);
    return session ? c.json(session) : c.json({ error: 'sign_in_failed' }, 500);
  })

  /**
   * Spends a refresh token and answers with a fresh pair. The old row is
   * deleted first: if that deletes nothing, the token was already spent or
   * never existed, and nothing is issued.
   */
  .post('/refresh', async (c) => {
    const refreshToken = (await readBody(c))?.refreshToken;
    if (typeof refreshToken !== 'string') {
      return invalid(c);
    }

    const { data, error } = await db(c.env)
      .from('refresh_tokens')
      .delete()
      .eq('token_hash', await hashRefreshToken(refreshToken))
      .gt('expires_at', new Date().toISOString())
      .select('user_id')
      .maybeSingle();

    if (error) {
      console.error('refresh', error);
      return c.json({ error: 'not_authenticated' }, 401);
    }
    const userId = (data as { user_id?: string } | null)?.user_id;
    if (!userId) {
      return unauthorized(c);
    }

    const session = await startSession(c.env, userId);
    return session ? c.json(session) : c.json({ error: 'not_authenticated' }, 401);
  })

  /** Ends this session, and only this one, so other phones stay signed in. */
  .post('/signout', requireUser, async (c) => {
    const refreshToken = (await readBody(c))?.refreshToken;
    if (typeof refreshToken === 'string') {
      await db(c.env)
        .from('refresh_tokens')
        .delete()
        .eq('token_hash', await hashRefreshToken(refreshToken));
    }
    return noContent(c);
  });

/** Reads the caller of a request that may or may not carry a token. */
export async function optionalUser(env: Env, authorization: string | undefined) {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  return token ? readAccessToken(token, env.JWT_SECRET) : null;
}
