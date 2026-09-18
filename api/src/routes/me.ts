import { Hono } from 'hono';

import { db } from '../clients.ts';
import { ProfileColumns, toPreferencePatch, toProfile, type ProfileRow } from '../contract.ts';
import type { AppEnv } from '../env.ts';
import { failure, invalid, noContent, readBody, requireUser } from '../http.ts';

export const me = new Hono<AppEnv>()
  .use(requireUser)

  /** One row by primary key, named columns only. */
  .get('/', async (c) => {
    const { data, error } = await db(c.env)
      .from('profiles')
      .select(ProfileColumns)
      .eq('id', c.var.caller.userId)
      .single<ProfileRow>();
    return error ? failure(c, error) : c.json(toProfile(data));
  })

  /** Preferences only. Subscription and invite fields cannot be named. */
  .patch('/', async (c) => {
    const patch = toPreferencePatch(await readBody(c));
    if (!patch) {
      return invalid(c);
    }

    const { data, error } = await db(c.env)
      .from('profiles')
      .update(patch)
      .eq('id', c.var.caller.userId)
      .select(ProfileColumns)
      .single<ProfileRow>();
    return error ? failure(c, error) : c.json(toProfile(data));
  })

  /**
   * Deletes the account and, by cascade, everything it owns: the profile, the
   * usage, the friendships and every live session. Play requires this for any
   * app with sign in. It does not cancel a store subscription, which lives
   * with Google, so the app says so before calling this.
   */
  .delete('/', async (c) => {
    const { error } = await db(c.env).from('users').delete().eq('id', c.var.caller.userId);
    if (error) {
      console.error('delete account', error);
      return c.json({ error: 'server_error' }, 500);
    }
    return noContent(c);
  });

export const feedback = new Hono<AppEnv>().use(requireUser).post('/', async (c) => {
  const body = await readBody(c);
  if (typeof body?.topic !== 'string' || typeof body?.message !== 'string') {
    return invalid(c);
  }

  /** No `.select()`, so nothing is read back. */
  const { error } = await db(c.env)
    .from('feedback')
    .insert({ user_id: c.var.caller.userId, topic: body.topic, message: body.message });
  return error ? failure(c, error) : noContent(c);
});
