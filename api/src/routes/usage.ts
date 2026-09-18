import { Hono } from 'hono';

import { db } from '../clients.ts';
import { DatePattern, MaxHistoryDays, historyAllowed, spanDays, todayUtc } from '../contract.ts';
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

    const { error } = await db(c.env).rpc('increment_usage', {
      p_user: c.var.caller.userId,
      p_days: days,
    });
    return error ? failure(c, error) : noContent(c);
  })

  /**
   * Raw rows for a date range, one per day per app. The app folds them into day
   * totals and app totals itself, so one range scan on the primary key answers
   * both instead of two aggregate queries. Reading past 7 days back needs Pro,
   * which this route now decides, since the policy that used to is gone.
   */
  .get('/', async (c) => {
    const from = c.req.query('from') ?? '';
    const to = c.req.query('to') ?? '';
    const span = spanDays(from, to);
    if (!DatePattern.test(from) || !DatePattern.test(to) || !(span >= 1 && span <= MaxHistoryDays)) {
      return invalid(c);
    }

    /** Only asked when the range reaches past the free window, so most reads skip it. */
    if (!historyAllowed(from, false, todayUtc())) {
      const { data: premium, error: premiumError } = await db(c.env).rpc('is_premium', {
        p_user: c.var.caller.userId,
      });
      if (premiumError) {
        return failure(c, premiumError);
      }
      if (premium !== true) {
        return c.json({ error: 'premium_required' }, 403);
      }
    }

    const { data, error } = await db(c.env)
      .from('daily_usage')
      .select('usage_date, app_key, reels')
      .eq('user_id', c.var.caller.userId)
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
