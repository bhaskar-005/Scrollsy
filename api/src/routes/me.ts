import { Hono } from 'hono';

import { adminClient, userClient } from '../clients.ts';
import { ProfileColumns, emailOf, toPreferencePatch, toProfile, type ProfileRow } from '../contract.ts';
import type { AppEnv } from '../env.ts';
import { failure, invalid, noContent, readBody, requireUser, unauthorized } from '../http.ts';

export const me = new Hono<AppEnv>()
  .use(requireUser)

  /** One row by primary key, named columns only. */
  .get('/', async (c) => {
    const { data, error } = await userClient(c.env, c.var.caller.authorization)
      .from('profiles')
      .select(ProfileColumns)
      .single<ProfileRow>();
    return error ? failure(c, error) : c.json(toProfile(data, emailOf(c.var.caller.token)));
  })

  /** Preferences only. Subscription and invite fields cannot be named. */
  .patch('/', async (c) => {
    const patch = toPreferencePatch(await readBody(c));
    if (!patch) {
      return invalid(c);
    }

    const { data, error } = await userClient(c.env, c.var.caller.authorization)
      .from('profiles')
      .update(patch)
      .eq('id', c.var.caller.userId)
      .select(ProfileColumns)
      .single<ProfileRow>();
    return error ? failure(c, error) : c.json(toProfile(data, emailOf(c.var.caller.token)));
  })

  /**
   * Deletes the account and, by cascade, everything it owns. Play requires this
   * for any app with sign in. It does not cancel a store subscription, which
   * lives with Google, so the app says so before calling this.
   *
   * The one route that checks the token with Auth itself, because it acts with
   * the admin key rather than as the caller.
   */
  .delete('/', async (c) => {
    const admin = adminClient(c.env);
    const { data, error } = await admin.auth.getUser(c.var.caller.token);
    if (error || !data.user) {
      return unauthorized(c);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
    if (deleteError) {
      console.error('delete account', deleteError);
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
  const { error } = await userClient(c.env, c.var.caller.authorization)
    .from('feedback')
    .insert({ topic: body.topic, message: body.message });
  return error ? failure(c, error) : noContent(c);
});
