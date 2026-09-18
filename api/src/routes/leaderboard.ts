import { Hono } from 'hono';

import { db } from '../clients.ts';
import { DatePattern } from '../contract.ts';
import type { AppEnv } from '../env.ts';
import { failure, invalid, requireUser } from '../http.ts';

/** You and your friends, fewest reels first, for the device's own calendar day. */
export const leaderboard = new Hono<AppEnv>().get('/', requireUser, async (c) => {
  const date = c.req.query('date') ?? '';
  if (!DatePattern.test(date)) {
    return invalid(c);
  }

  const { data, error } = await db(c.env).rpc('leaderboard_for_me', {
    p_user: c.var.caller.userId,
    p_date: date,
  });
  if (error) {
    return failure(c, error);
  }

  type Row = {
    id: string;
    display_name: string;
    avatar_url: string | null;
    premium: boolean;
    reels: number;
    is_me: boolean;
  };
  return c.json(
    ((data ?? []) as Row[]).map((row) => ({
      id: row.id,
      name: row.display_name,
      avatarUrl: row.avatar_url,
      premium: row.premium,
      reels: row.reels,
      isMe: row.is_me,
    })),
  );
});
