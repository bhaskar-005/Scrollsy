import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MaxDaysPerCall, planSync, toDays } from '../src/lib/sync-plan.ts';
import type { PendingRow } from '../src/lib/usage-store.ts';

/**
 * The offline case. Run with `npm run test:sync`.
 *
 * Nothing native is imported here, which is the point of keeping this logic in
 * its own file: the part that decides what gets sent can be checked without a
 * phone, a server, or a database.
 */

const day = (date: string, pending: number, app: PendingRow['app'] = 'tiktok'): PendingRow => ({
  date,
  app,
  pending,
});

/** `n` days of counting, ending on the given day. */
function offlineFor(days: number, endingOn = '2026-09-16'): PendingRow[] {
  const end = new Date(`${endingOn}T00:00:00Z`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (days - 1 - index));
    return day(date.toISOString().slice(0, 10), 40 + index);
  });
}

test('a day counted across three apps is one entry, not three', () => {
  const days = toDays([
    day('2026-09-16', 12, 'instagram'),
    day('2026-09-16', 30, 'tiktok'),
    day('2026-09-16', 4, 'youtube'),
  ]);

  assert.equal(days.length, 1);
  assert.deepEqual(days[0], {
    date: '2026-09-16',
    apps: { instagram: 12, tiktok: 30, youtube: 4 },
  });
});

test('days go out oldest first, whatever order they were read in', () => {
  const dates = toDays([day('2026-09-16', 1), day('2026-09-02', 2), day('2026-09-09', 3)]).map(
    (entry) => entry.date,
  );
  assert.deepEqual(dates, ['2026-09-02', '2026-09-09', '2026-09-16']);
});

test('everything the device is holding goes in one call when it fits', () => {
  const batches = planSync(offlineFor(31));
  assert.equal(batches.length, 1);
  assert.equal(batches[0].days.length, 31);
});

test('more days than one call may carry are split rather than refused whole', () => {
  /**
   * The device keeps 31 days, so this cannot happen today. It is here because
   * raising `KeepDays` later would otherwise make every sync fail silently:
   * `increment_usage` refuses an oversized array outright rather than taking
   * what fits, and the app treats that refusal as "try again later", forever.
   */
  const batches = planSync(offlineFor(45));

  assert.equal(batches.length, 2);
  assert.equal(batches[0].days.length, MaxDaysPerCall);
  assert.equal(batches[1].days.length, 45 - MaxDaysPerCall);
  assert.ok(batches.every((batch) => batch.days.length <= MaxDaysPerCall));
});

test('a day is never split across two calls', () => {
  const rows = offlineFor(45).flatMap((row) => [row, { ...row, app: 'instagram' as const }]);
  const seen = new Map<string, number>();

  for (const [index, batch] of planSync(rows).entries()) {
    for (const entry of batch.days) {
      assert.equal(seen.has(entry.date), false, `${entry.date} appears in two calls`);
      seen.set(entry.date, index);
    }
  }
  assert.equal(seen.size, 45);
});

test('each call carries exactly the rows that will be marked as sent', () => {
  const rows = offlineFor(45);
  const batches = planSync(rows);

  /** Every row is in exactly one call, so none is sent twice or left behind. */
  const marked = batches.flatMap((batch) => batch.rows);
  assert.equal(marked.length, rows.length);
  assert.deepEqual(new Set(marked).size, rows.length);

  /** And a call's rows are only that call's days. A failure leaves the rest pending. */
  for (const batch of batches) {
    const dates = new Set(batch.days.map((entry) => entry.date));
    assert.ok(batch.rows.every((row) => dates.has(row.date)));
  }
});

test('nothing pending is no calls at all, not an empty one', () => {
  assert.deepEqual(planSync([]), []);
});
