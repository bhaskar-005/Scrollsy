import { createRemoteJWKSet, jwtVerify } from 'jose';

import type { Env } from './env.ts';

/**
 * Verifies Supabase access tokens.
 *
 * The other backend never did this: it handed each token to Postgres, which
 * checked it. Prisma talks to the database as one privileged user, so nothing
 * downstream will ever check a token. This is the only gate, and every route
 * depends on it.
 */

/** Cached per isolate. `jose` refreshes the key set on its own. */
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function keysFor(issuer: string) {
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    keySets.set(issuer, keys);
  }
  return keys;
}

/** Who a valid token names. Null when it is not valid. Never throws. */
export type VerifiedCaller = { userId: string; email: string | null };

export async function verifiedCaller(env: Env, token: string): Promise<VerifiedCaller | null> {
  const issuer = `${env.SUPABASE_URL}/auth/v1`;
  const options = { issuer, audience: 'authenticated' } as const;

  try {
    const { payload } = env.SUPABASE_JWT_SECRET
      ? // A project still on legacy symmetric keys.
        await jwtVerify(token, new TextEncoder().encode(env.SUPABASE_JWT_SECRET), options)
      : await jwtVerify(token, keysFor(issuer), options);

    return typeof payload.sub === 'string'
      ? { userId: payload.sub, email: typeof payload.email === 'string' ? payload.email : null }
      : null;
  } catch {
    return null;
  }
}
