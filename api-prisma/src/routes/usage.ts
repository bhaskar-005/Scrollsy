import { Hono } from 'hono';

import { DatePattern, MaxHistoryDays, spanDays } from '../contract.ts';
import type { AppEnv } from '../env.ts';
import { invalid, noContent, readBody, requireUser } from '../http.ts';
import { historyAllowed, toUsageRows } from '../rules.ts';

/** The device's own calendar day, as it sent it, falling back to the server's. */
const today = (sent: string | undefined) =>
  sent && DatePattern.test(sent) ? sent : new Date().toISOString().slice(0, 10);

export const usage = new Hono<AppEnv>()
  .use(requireUser)

  /** Every pending day in one call, added rather than overwritten. */
  .post('/sync', async (c) => {
    const body = await readBody(c);
    if (!Array.isArray(body?.days)) {
      return invalid(c);
    }

    const rows = toUsageRows(body.days, today(body.today as string | undefined));
    if (rows.length === 0) {
      return noContent(c);
    }

    await c.var.store.addUsage(c.var.caller.userId, rows);
    return noContent(c);
  })

  /**
   * Raw rows for a range, one per day per app. Past 7 days back is a paid
   * feature, and this check is now the only thing enforcing that, so it reads
   * the account rather than trusting anything the caller sent.
   */
  .get('/', async (c) => {
    const from = c.req.query('from') ?? '';
    const to = c.req.query('to') ?? '';
    const span = spanDays(from, to);
    if (!DatePattern.test(from) || !DatePattern.test(to) || !(span >= 1 && span <= MaxHistoryDays)) {
      return invalid(c);
    }

    const profile = await c.var.store.profile(c.var.caller.userId);
    if (!historyAllowed(from, profile?.premium ?? false, today(c.req.query('today')))) {
      return c.json({ error: 'pro_required' }, 403);
    }

    return c.json(await c.var.store.usageRange(c.var.caller.userId, from, to));
  });
