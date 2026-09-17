import { localDateKey, seedSync, shiftDateKey, type AppKey } from '@/lib/usage-store';

/**
 * Development only, and only into an empty store. Writes an invented week
 * ending today, so the screens have something to draw before the counting
 * service exists.
 *
 * Every row lands already marked synced, so a signed in dev build can never
 * upload these numbers. Delete this file once counting is real.
 */

/** A week, in the order the days will appear, oldest first. */
const Days = [402, 512, 468, 148, 260, 412, 338];

/** How a day splits between the apps. Adds up to one. */
const Split: [AppKey, number][] = [
  ['instagram', 0.5],
  ['tiktok', 0.36],
  ['youtube', 0.14],
];

if (__DEV__) {
  const today = localDateKey();

  const rows = Days.flatMap((reels, index) => {
    const date = shiftDateKey(today, index - (Days.length - 1));
    let left = reels;

    /** The last app takes the rounding, so the parts add up to the day. */
    return Split.map(([app, share], appIndex) => {
      const count = appIndex === Split.length - 1 ? left : Math.round(reels * share);
      left -= count;
      return { date, app, reels: count };
    });
  });

  seedSync(rows);
}
