import { Hono } from 'hono';

import { authFailureStatus, toSession, type SessionLike } from '../contract.ts';
import type { AppEnv } from '../env.ts';
import { authFetch, invalid, noContent, readBody, requireUser, unauthorized } from '../http.ts';
import { toProfileJson } from '../prisma-store.ts';
import { toPreferencePatch } from '../rules.ts';

/** Sessions. Supabase Auth still issues them, this just relays. */
export const auth = new Hono<AppEnv>()
  .post('/google', async (c) => {
    const idToken = (await readBody(c))?.idToken;
    if (typeof idToken !== 'string') {
      return invalid(c);
    }

    const response = await authFetch(c.env, 'token?grant_type=id_token', {
      method: 'POST',
      body: JSON.stringify({ provider: 'google', id_token: idToken }),
    });
    if (!response.ok) {
      return c.json({ error: 'sign_in_failed' }, authFailureStatus(response.status));
    }
    return c.json(toSession((await response.json()) as SessionLike));
  })

  .post('/refresh', async (c) => {
    const refreshToken = (await readBody(c))?.refreshToken;
    if (typeof refreshToken !== 'string') {
      return invalid(c);
    }

    const response = await authFetch(c.env, 'token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) {
      return c.json({ error: 'not_authenticated' }, authFailureStatus(response.status));
    }
    return c.json(toSession((await response.json()) as SessionLike));
  })

  .post('/signout', requireUser, async (c) => {
    await authFetch(c.env, 'logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.var.caller.token}` },
    });
    return noContent(c);
  });

export const me = new Hono<AppEnv>()
  .use(requireUser)

  .get('/', async (c) => {
    const profile = await c.var.store.profile(c.var.caller.userId);
    return profile ? c.json(toProfileJson(profile, c.var.caller.email)) : unauthorized(c);
  })

  /**
   * Preferences only. `toPreferencePatch` is what keeps subscription, invite and
   * premium fields out of reach, since there is no column grant here doing it.
   */
  .patch('/', async (c) => {
    const patch = toPreferencePatch(await readBody(c));
    if (!patch) {
      return invalid(c);
    }

    const profile = await c.var.store.updatePreferences(c.var.caller.userId, patch);
    return profile ? c.json(toProfileJson(profile, c.var.caller.email)) : unauthorized(c);
  })

  /** Deletes the account. Everything it owns goes with it, by cascade. */
  .delete('/', async (c) => {
    const response = await authFetch(c.env, `admin/users/${c.var.caller.userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${c.env.SUPABASE_SECRET_KEY}` },
    });
    if (!response.ok) {
      console.error('delete account', response.status);
      return c.json({ error: 'server_error' }, 500);
    }
    return noContent(c);
  });

export const feedback = new Hono<AppEnv>().use(requireUser).post('/', async (c) => {
  const body = await readBody(c);
  const topics = ['bug', 'idea', 'billing', 'other'];
  if (typeof body?.topic !== 'string' || !topics.includes(body.topic)) {
    return invalid(c);
  }
  if (typeof body.message !== 'string' || body.message.length < 1 || body.message.length > 4000) {
    return invalid(c);
  }

  await c.var.store.addFeedback(c.var.caller.userId, body.topic, body.message);
  return noContent(c);
});
