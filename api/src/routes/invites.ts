import { Hono } from 'hono';

import { db } from '../clients.ts';
import { InviteCodePattern } from '../contract.ts';
import type { AppEnv } from '../env.ts';
import { failure, rateLimited, requireUser } from '../http.ts';

const notFound = { error: 'invite_invalid' } as const;

/** Sign in is required per route, not for the whole router, because the preview is public. */
export const invites = new Hono<AppEnv>()
  /** A live code for the caller, reused until it is close to expiring. */
  .post('/', requireUser, async (c) => {
    const { data, error } = await db(c.env).rpc('create_invite', {
      p_user: c.var.caller.userId,
    });
    return error ? failure(c, error) : c.json({ code: data as string });
  })

  /**
   * Who sent an invite, for the invite web page to show before anyone has the
   * app. Public, since the person holding the link is not signed in anywhere.
   * Only the inviter's name and photo: never their counts, which a link passed
   * around a group chat should not broadcast.
   *
   * Cached briefly at the edge, so a link opened by a whole group chat at once
   * costs one database read, not one per person.
   */
  .get('/:code', async (c) => {
    const code = c.req.param('code');
    /** A malformed code cannot exist, so it never reaches the database. */
    if (!InviteCodePattern.test(code)) {
      return c.json(notFound, 404);
    }

    const { success } = await c.env.PUBLIC_LIMIT.limit({ key: `invite:${code}` });
    if (!success) {
      return rateLimited(c);
    }

    const { data, error } = await db(c.env).rpc('invite_preview', { p_code: code });
    if (error) {
      return failure(c, error);
    }

    const inviter = ((data ?? []) as { name: string; avatar_url: string | null }[])[0];
    if (!inviter) {
      return c.json(notFound, 404);
    }

    c.header('Cache-Control', 'public, max-age=60');
    return c.json({ name: inviter.name, avatarUrl: inviter.avatar_url });
  })

  .post('/:code/accept', requireUser, async (c) => {
    const code = c.req.param('code');
    if (!InviteCodePattern.test(code)) {
      return c.json(notFound, 404);
    }

    const { data, error } = await db(c.env).rpc('accept_invite', {
      p_user: c.var.caller.userId,
      p_code: code,
    });
    return error ? failure(c, error) : c.json({ inviterId: data as string });
  });
