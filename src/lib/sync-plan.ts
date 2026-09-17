import type { AppKey, PendingRow } from '@/lib/usage-store';

/**
 * What one sync pass will send, worked out before anything is sent. Pure, and
 * free of anything native, so it is tested on its own. See sync-plan.test.ts.
 *
 * This is the part that matters after a long time offline, when the device is
 * holding weeks of days rather than one.
 */

export type DayPayload = { date: string; apps: Partial<Record<AppKey, number>> };

/**
 * The most days one call may carry. `increment_usage` refuses a longer array
 * outright rather than taking what fits, so sending more than this would have
 * the whole payload refused and nothing would ever upload.
 */
export const MaxDaysPerCall = 31;

/** Pending rows grouped into the `p_days` shape `increment_usage` takes, oldest first. */
export function toDays(rows: PendingRow[]): DayPayload[] {
  const days = new Map<string, Partial<Record<AppKey, number>>>();
  for (const row of rows) {
    const apps = days.get(row.date) ?? {};
    apps[row.app] = row.pending;
    days.set(row.date, apps);
  }
  return [...days]
    .map(([date, apps]) => ({ date, apps }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * One pass as a list of calls. A day is never split across two of them, so a
 * call that fails leaves whole days behind rather than half of one.
 *
 * Each batch carries the rows it is made of, because those exact rows are what
 * gets marked as sent afterwards. Marking anything else would either lose
 * reels counted since, or mark reels that never arrived.
 */
export function planSync(rows: PendingRow[]): { days: DayPayload[]; rows: PendingRow[] }[] {
  const days = toDays(rows);
  const batches: { days: DayPayload[]; rows: PendingRow[] }[] = [];

  for (let start = 0; start < days.length; start += MaxDaysPerCall) {
    const batch = days.slice(start, start + MaxDaysPerCall);
    const dates = new Set(batch.map((day) => day.date));
    batches.push({ days: batch, rows: rows.filter((row) => dates.has(row.date)) });
  }

  return batches;
}
