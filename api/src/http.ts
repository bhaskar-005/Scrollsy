import type { Context, MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { toFailure, tokenOf, type DatabaseError } from './contract.ts';
import type { AppEnv } from './env.ts';
import { readAccessToken } from './tokens.ts';

export const invalid = (c: Context) => c.json({ error: 'invalid_request' }, 400);
export const unauthorized = (c: Context) => c.json({ error: 'not_authenticated' }, 401);
export const rateLimited = (c: Context) => c.json({ error: 'rate_limited' }, 429);
export const noContent = (c: Context) => c.body(null, 204);

/** A Supabase error, answered with one stable code. Detail stays in the logs. */
export function failure(c: Context, error: DatabaseError) {
  const { status, code } = toFailure(error);
  if (status >= 500) {
    console.error('database', error);
  }
  return c.json({ error: code }, status as ContentfulStatusCode);
}

/** The body as a JSON object, or null when it is missing, malformed, or not an object. */
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
 * Lets a request through only with a bearer token this Worker signed, and
 * within that caller's rate limit.
 *
 * The signature is checked here, which it has to be: Postgres is no longer
 * handed the token and no longer decides who anyone is. Everything past this
 * point treats `caller.userId` as proven.
 *
 * The limit is keyed on a hash of the token rather than the id inside it, so a
 * forged token cannot be used to spend someone else's allowance before the
 * check above rejects it.
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

  const userId = await readAccessToken(token, c.env.JWT_SECRET);
  if (!userId) {
    return unauthorized(c);
  }

  c.set('caller', { token, userId });
  await next();
};
