import { Hono } from 'hono';

import { userClient } from '../clients.ts';
import { DatePattern, MaxHistoryDays, spanDays } from '../contract.ts';
import type { AppEnv } from '../env.ts';
import { failure, invalid, noContent, readBody, requireUser } from '../http.ts';

export const usage = new Hono<AppEnv>()
  .use(requireUser)

  /** Every pending day from the device in one call. See `increment_usage`. */
  .post('/sync', async (c) => {
    const days = (await readBody(c))?.days;
    if (!Array.isArray(days)) {
      return invalid(c);
    }
    /** Nothing to add, so no query at all. */
    if (days.length === 0) {
      return noContent(c);
    }

    const { error } = await userClient(c.env, c.var.caller.authorization).rpc('increment_usage', {
      p_days: days,
    });
    return error ? failure(c, error) : noContent(c);
  })

  /**
   * Raw rows for a date range, one per day per app. The app folds them into day
   * totals and app totals itself, so one range scan on the primary key answers
   * both instead of two aggregate queries. Reading past 7 days back needs Pro,
   * which the database enforces, not this route.
   */
  .get('/', async (c) => {
    const from = c.req.query('from') ?? '';
    const to = c.req.query('to') ?? '';
    const span = spanDays(from, to);
    if (!DatePattern.test(from) || !DatePattern.test(to) || !(span >= 1 && span <= MaxHistoryDays)) {
      return invalid(c);
    }

    const { data, error } = await userClient(c.env, c.var.caller.authorization)
      .from('daily_usage')
      .select('usage_date, app_key, reels')
      .gte('usage_date', from)
      .lte('usage_date', to)
      .order('usage_date');
    if (error) {
      return failure(c, error);
    }

    type Row = { usage_date: string; app_key: string; reels: number };
    return c.json(
      ((data ?? []) as Row[]).map((row) => ({ date: row.usage_date, app: row.app_key, reels: row.reels })),
    );
  });
