import type { Context, MiddlewareHandler } from 'hono';

import { verifiedCaller } from './auth.ts';
import { tokenOf } from './contract.ts';
import type { AppEnv, Env } from './env.ts';
import type { Store } from './store.ts';

export const invalid = (c: Context) => c.json({ error: 'invalid_request' }, 400);
export const unauthorized = (c: Context) => c.json({ error: 'not_authenticated' }, 401);
export const rateLimited = (c: Context) => c.json({ error: 'rate_limited' }, 429);
export const noContent = (c: Context) => c.body(null, 204);

export async function readBody(c: Context): Promise<Record<string, unknown> | null> {
  const parsed: unknown = await c.req.json().catch(() => null);
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

/**
 * Verifies the caller's token and keeps them inside their rate limit.
 *
 * Unlike the other backend, this actually verifies the signature here, because
 * Prisma talks to Postgres as one privileged user and nothing downstream will
 * check it. If this middleware is wrong, everything behind it is open.
 *
 * The limit is keyed on a hash of the token, never on the user id inside it,
 * which anyone could forge to burn through someone else's allowance.
 */
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = tokenOf(c.req.header('Authorization'));
  if (!token) {
    return unauthorized(c);
  }

  const { success } = await c.env.USER_LIMIT.limit({ key: await sha256(token) });
  if (!success) {
    return rateLimited(c);
  }

  const verified = await verifiedCaller(c.env, token);
  if (!verified) {
    return unauthorized(c);
  }

  c.set('caller', { userId: verified.userId, email: verified.email, token });
  await next();
};

/** The store for this request, built by the factory the app was made with. */
export type StoreFactory = (env: Env) => { store: Store; dispose: () => Promise<void> };

export const withStore = (factory: StoreFactory): MiddlewareHandler<AppEnv> =>
  async function store(c, next) {
    const { store: made, dispose } = factory(c.env);
    c.set('store', made);
    try {
      await next();
    } finally {
      /** Closing the connection must not hold up the response. */
      try {
        c.executionCtx.waitUntil(dispose());
      } catch {
        await dispose();
      }
    }
  };

/** Supabase Auth, over its REST API. The only part of Supabase this backend still calls. */
export async function authFetch(env: Env, path: string, init: RequestInit = {}) {
  return fetch(`${env.SUPABASE_URL}/auth/v1/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      ...(init.headers ?? {}),
    },
  });
}
