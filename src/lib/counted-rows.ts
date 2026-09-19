import type { AppKey, CountedRow } from '@/lib/usage-store';

/**
 * What the counting service hands over, checked before it is written.
 *
 * Nothing native is imported here, so this can be tested without a phone. It
 * is the same guard the server puts on `increment_usage`, kept on this side
 * too, because the local store is what every screen draws from and a bad row
 * would sit there looking like a real day.
 *
 * Anything unusable is dropped rather than refused. A single odd row should
 * not throw away a week of good ones, which is exactly what the server decided
 * for the same reason.
 */

const DatePattern = /^\d{4}-\d{2}-\d{2}$/;

/** Must match the migration's check constraint and the service's own list. */
const KnownApps: readonly string[] = ['instagram', 'tiktok', 'youtube', 'snapchat'];

/** The clamp the database applies, applied here so both agree. */
export const MaxReelsPerDay = 5000;

/** How far back a counted day is still believed. Matches the server's window. */
export const MaxCountedAgeDays = 30;

const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

/**
 * The rows worth writing, from whatever the service returned.
 *
 * `today` is the device's own date key, so a phone whose clock is wrong drops
 * its own nonsense rather than writing a day years away that would stretch
 * every chart that reads it.
 */
export function toCountedRows(counted: unknown, today: string): CountedRow[] {
  if (!Array.isArray(counted)) {
    return [];
  }

  const now = dayNumber(today);
  const rows: CountedRow[] = [];

  for (const entry of counted) {
    if (entry === null || typeof entry !== 'object') {
      continue;
    }
    const { date, app, reels } = entry as { date?: unknown; app?: unknown; reels?: unknown };

    if (typeof date !== 'string' || !DatePattern.test(date)) {
      continue;
    }
    if (typeof app !== 'string' || !KnownApps.includes(app)) {
      continue;
    }
    if (typeof reels !== 'number' || !Number.isFinite(reels) || reels <= 0) {
      continue;
    }

    /** Tomorrow is allowed, for a phone an hour ahead of the day it counted in. */
    const age = now - dayNumber(date);
    if (age > MaxCountedAgeDays || age < -1) {
      continue;
    }

    rows.push({
      date,
      app: app as AppKey,
      reels: Math.min(Math.floor(reels), MaxReelsPerDay),
    });
  }

  return rows;
}
