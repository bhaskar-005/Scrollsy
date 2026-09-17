import { Hono } from 'hono';

import { DatePattern, InviteCodePattern } from '../contract.ts';
import type { AppEnv } from '../env.ts';
import { invalid, rateLimited, requireUser } from '../http.ts';
import { inviteExpiry, inviteIsLive, needsFreshInvite, newInviteCode } from '../rules.ts';

const notFound = { error: 'invite_invalid' } as const;

export const leaderboard = new Hono<AppEnv>().get('/', requireUser, async (c) => {
  const date = c.req.query('date') ?? '';
  if (!DatePattern.test(date)) {
    return invalid(c);
  }

  const board = await c.var.store.board(c.var.caller.userId, date);
  /** Fewest reels wins, and ties settle by name, as the database function did. */
  const ranked = [...board].sort((a, b) => a.reels - b.reels || a.name.localeCompare(b.name));

  return c.json(ranked.map((person) => ({ ...person, isMe: person.id === c.var.caller.userId })));
});

export const invites = new Hono<AppEnv>()
  /** A live code, minting a fresh one only when there is none or it is nearly out. */
  .post('/', requireUser, async (c) => {
    const profile = await c.var.store.profile(c.var.caller.userId);
    if (!profile) {
      return c.json({ error: 'not_authenticated' }, 401);
    }

    if (profile.inviteCode && !needsFreshInvite(profile.inviteExpiresAt, new Date())) {
      return c.json({ code: profile.inviteCode });
    }

    const code = newInviteCode();
    await c.var.store.setInvite(c.var.caller.userId, code, inviteExpiry(new Date()));
    return c.json({ code });
  })

  /**
   * Who sent an invite, for the website, before anyone has the app. Public, and
   * only a name and a photo: never counts, which a link passed around a group
   * chat should not broadcast.
   */
  .get('/:code', async (c) => {
    const code = c.req.param('code');
    if (!InviteCodePattern.test(code)) {
      return c.json(notFound, 404);
    }

    const { success } = await c.env.PUBLIC_LIMIT.limit({ key: `invite:${code}` });
    if (!success) {
      return rateLimited(c);
    }

    const inviter = await c.var.store.inviterByCode(code);
    if (!inviter || !inviteIsLive(inviter.inviteExpiresAt, new Date())) {
      return c.json(notFound, 404);
    }

    c.header('Cache-Control', 'public, max-age=60');
    return c.json({ name: inviter.name, avatarUrl: inviter.avatarUrl });
  })

  .post('/:code/accept', requireUser, async (c) => {
    const code = c.req.param('code');
    if (!InviteCodePattern.test(code)) {
      return c.json(notFound, 404);
    }

    const inviter = await c.var.store.inviterByCode(code);
    if (!inviter || !inviteIsLive(inviter.inviteExpiresAt, new Date())) {
      return c.json(notFound, 404);
    }
    if (inviter.id === c.var.caller.userId) {
      return c.json({ error: 'invite_own' }, 400);
    }

    /** The cap is checked inside the transaction, not here, so two at once cannot both pass. */
    const outcome = await c.var.store.acceptInvite(c.var.caller.userId, inviter.id);
    if (outcome === 'cap_self') {
      return c.json({ error: 'friend_cap_self' }, 409);
    }
    if (outcome === 'cap_inviter') {
      return c.json({ error: 'friend_cap_inviter' }, 409);
    }

    /** A second tap on the same link is a no-op, not an error. */
    return c.json({ inviterId: inviter.id });
  });
