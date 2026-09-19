import ReelCounter from '@/modules/reel-counter/src/ReelCounterModule';
import { notifyLimitCrossed } from '@/lib/notify';
import { toCountedRows } from '@/lib/counted-rows';
import { addCounted, localDateKey, readDay } from '@/lib/usage-store';

/**
 * The seam between the counting service and the app.
 *
 * The service keeps running when this app is closed, and a closed app has no
 * JavaScript to hand a number to, so the service tallies natively and the app
 * collects on the way back in. Collecting clears the tally, so nothing lands
 * twice, and it is additive on this side, so a collection that crosses
 * midnight adds to the day it is read in rather than being lost.
 */

/** Whether a build has the service in it at all. False in Expo Go and on the web. */
export const countingAvailable = ReelCounter !== null;

/** Whether Android has the counting service switched on for this app. */
export function isCounting(): boolean {
  return ReelCounter?.isCounting() ?? false;
}

/**
 * Takes everything counted since the last call into the device's own store,
 * then tells the floating pill what today's real total is, so the number over
 * Instagram and the number on the home screen are the same number.
 */
export async function collectCounted(): Promise<void> {
  if (!ReelCounter) {
    return;
  }

  /**
   * Every day it slept through, checked, then written to its own date in one
   * transaction. Checked because this is the only door into the local store
   * and every screen draws from it.
   */
  const day = localDateKey();
  const counted = toCountedRows(ReelCounter.drain(), day);
  if (counted.length > 0) {
    await addCounted(counted);
  }

  const today = await readDay(day);
  ReelCounter.setTotal(today);

  /** The only moment the app learns the count moved, so the only place to say so. */
  await notifyLimitCrossed(today);
}

/** Takes the pill off the screen, for turning counting off. */
export function hideCounter(): void {
  ReelCounter?.hideOverlay();
}
