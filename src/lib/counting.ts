import ReelCounter from '@/modules/reel-counter/src/ReelCounterModule';
import type { CounterPosition, CounterSize, CounterStyle } from '@/constants/counter';
import { notifyLimitCrossed } from '@/lib/notify';
import { counterSizeOf, counterStyleOf, readProfile, setPreferences } from '@/lib/profile';
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

  syncLook();

  /** The only moment the app learns the count moved, so the only place to say so. */
  await notifyLimitCrossed(today);
}

/**
 * Puts the pill and the profile back in step, both ways.
 *
 * The style travels out, because a profile pulled from the server on a new
 * phone is a choice the service has never heard. The position travels back,
 * because it is chosen by dragging the thing over Instagram and this is the
 * first moment the app is running to hear about it.
 */
function syncLook(): void {
  if (!ReelCounter) {
    return;
  }

  const profile = readProfile();
  ReelCounter.setStyle?.(counterStyleOf(profile));
  ReelCounter.setSize?.(counterSizeOf(profile));

  const dragged = ReelCounter.position?.();
  if (!dragged) {
    return;
  }
  const held = profile.counterPosition;
  if (dragged.x !== held.x || dragged.y !== held.y) {
    setPreferences({ counterPosition: dragged });
  }
}

/** Takes the pill off the screen, for turning counting off. */
export function hideCounter(): void {
  ReelCounter?.hideOverlay();
}

/**
 * Tells the service how the pill should look. The service draws it while this
 * app is closed, so the choice has to be left somewhere it can find rather
 * than held in a hook.
 */
export function setCounterStyle(style: CounterStyle): void {
  ReelCounter?.setStyle?.(style);
}

/** And how big it floats. Same reason it cannot just read the profile. */
export function setCounterSize(size: CounterSize): void {
  ReelCounter?.setSize?.(size);
}

/**
 * Where the pill was last dragged to. The person moves it over Instagram, so
 * the app only ever learns about it on the way back in.
 */
export function counterPosition(): CounterPosition | null {
  return ReelCounter?.position?.() ?? null;
}
