import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MaxReelsPerDay, toCountedRows } from '../src/lib/counted-rows.ts';

/**
 * What the counting service hands back, before any of it is written.
 *
 * Nothing native is imported here, which is the point of keeping this logic in
 * its own file: the guard on the local store can be checked without a phone.
 */

const today = '2026-09-19';

test('a week the app slept through keeps its days apart', () => {
  const rows = toCountedRows(
    [
      { date: '2026-09-17', app: 'instagram', reels: 40 },
      { date: '2026-09-18', app: 'tiktok', reels: 12 },
      { date: '2026-09-19', app: 'youtube', reels: 3 },
    ],
    today,
  );

  assert.equal(rows.length, 3);
  /** Each day stays its own row, rather than piling onto the day it was collected. */
  assert.deepEqual(
    rows.map((row) => row.date),
    ['2026-09-17', '2026-09-18', '2026-09-19'],
  );
});

test('the same day from several apps stays several rows', () => {
  const rows = toCountedRows(
    [
      { date: today, app: 'instagram', reels: 10 },
      { date: today, app: 'snapchat', reels: 4 },
    ],
    today,
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.app).sort(), ['instagram', 'snapchat']);
});

test('a bad row is dropped and the good ones around it still land', () => {
  const rows = toCountedRows(
    [
      { date: today, app: 'instagram', reels: 10 },
      { date: 'not-a-date', app: 'tiktok', reels: 5 },
      { date: today, app: 'bereal', reels: 5 },
      { date: today, app: 'tiktok', reels: 0 },
      { date: today, app: 'tiktok', reels: -4 },
      { date: today, app: 'tiktok', reels: 'lots' },
      { date: today, reels: 5 },
      null,
      'nonsense',
      { date: today, app: 'youtube', reels: 7 },
    ],
    today,
  );

  assert.deepEqual(rows, [
    { date: today, app: 'instagram', reels: 10 },
    { date: today, app: 'youtube', reels: 7 },
  ]);
});

test('a wrong clock cannot write a day that stretches every chart', () => {
  /** Older than the window the server would take. */
  assert.equal(toCountedRows([{ date: '2020-01-01', app: 'tiktok', reels: 5 }], today).length, 0);
  /** Far in the future. */
  assert.equal(toCountedRows([{ date: '2030-01-01', app: 'tiktok', reels: 5 }], today).length, 0);
  /** Tomorrow is fine, for a phone an hour ahead of the day it counted in. */
  assert.equal(toCountedRows([{ date: '2026-09-20', app: 'tiktok', reels: 5 }], today).length, 1);
  /** The far edge of the window is still taken. */
  assert.equal(toCountedRows([{ date: '2026-08-20', app: 'tiktok', reels: 5 }], today).length, 1);
});

test('an absurd count is clamped rather than thrown away', () => {
  const rows = toCountedRows([{ date: today, app: 'tiktok', reels: 999_999 }], today);
  assert.equal(rows[0]?.reels, MaxReelsPerDay);
});

test('a fraction is floored, so the store only ever holds whole reels', () => {
  const rows = toCountedRows([{ date: today, app: 'tiktok', reels: 4.8 }], today);
  assert.equal(rows[0]?.reels, 4);
});

test('nothing at all is nothing, not a crash', () => {
  assert.deepEqual(toCountedRows([], today), []);
  assert.deepEqual(toCountedRows(null, today), []);
  assert.deepEqual(toCountedRows(undefined, today), []);
  assert.deepEqual(toCountedRows({ date: today }, today), []);
});
