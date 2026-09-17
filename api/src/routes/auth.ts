import { Hono } from 'hono';

import { adminClient, publicClient } from '../clients.ts';
import { authFailureStatus, toSession } from '../contract.ts';
import type { AppEnv } from '../env.ts';
import { invalid, noContent, readBody, requireUser } from '../http.ts';

/**
 * Sessions. No rate limit of our own on sign in and refresh: there is no
 * caller identity yet to key one on, and Supabase Auth already limits both.
 */
export const auth = new Hono<AppEnv>()
  /** A Google ID token from the device in, a session out. */
  .post('/google', async (c) => {
    const idToken = (await readBody(c))?.idToken;
    if (typeof idToken !== 'string') {
      return invalid(c);
    }

    const { data, error } = await publicClient(c.env).auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error || !data.session) {
      return c.json({ error: 'sign_in_failed' }, authFailureStatus(error?.status));
    }
    return c.json(toSession(data.session));
  })

  .post('/refresh', async (c) => {
    const refreshToken = (await readBody(c))?.refreshToken;
    if (typeof refreshToken !== 'string') {
      return invalid(c);
    }

    const { data, error } = await publicClient(c.env).auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      return c.json({ error: 'not_authenticated' }, authFailureStatus(error?.status));
    }
    return c.json(toSession(data.session));
  })

  /** Revokes this session's refresh token, so it cannot be used again. */
  .post('/signout', requireUser, async (c) => {
    await adminClient(c.env).auth.admin.signOut(c.var.caller.token);
    return noContent(c);
  });
