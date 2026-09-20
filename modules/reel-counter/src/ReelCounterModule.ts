import { NativeModule, requireOptionalNativeModule } from 'expo';

/** App keys match the usage store, the migration and the API. */
export type CountedApp = 'instagram' | 'tiktok' | 'youtube' | 'snapchat';

/**
 * One day of one app. Days the app slept through come back as their own rows,
 * so a week of counting lands on the week rather than on today.
 */
export type CountedRow = { date: string; app: CountedApp; reels: number };

declare class ReelCounterModule extends NativeModule<{}> {
  /** Whether Android has the counting service switched on for this app. */
  isCounting(): boolean;
  /** Everything counted since the last call, one row per day per app, then cleared. */
  drain(): CountedRow[];
  /** Puts the floating pill back in step with today's real total. */
  setTotal(total: number): void;
  /**
   * How the pill should look. One of `CounterStyles`.
   *
   * Optional for the same reason the module itself is: a build made before
   * this function existed still runs this JavaScript, and calling something
   * its native half has never heard of throws rather than doing nothing.
   */
  setStyle?(style: string): void;
  /** Where it was last dragged to, as a fraction of the screen. Optional, as above. */
  position?(): { x: number; y: number } | null;
  hideOverlay(): void;
}

/**
 * Null in Expo Go, on the web, and in any build made before this module
 * existed, so every caller has to answer for that rather than crash a screen.
 */
export default requireOptionalNativeModule<ReelCounterModule>('ReelCounter');
