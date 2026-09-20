/**
 * The floating counter's own settings. The style list matches the check
 * constraint on `profiles`, so anything the picker can produce is something
 * the database will accept.
 */

export const CounterStyles = ['pill', 'outline', 'glass', 'plain', 'mascot'] as const;
export type CounterStyle = (typeof CounterStyles)[number];

/**
 * Where it sits over the screen, as a fraction of width and height. No screen
 * in the app sets this: the pill is dragged where it is used, over the reels,
 * which is a better place to choose than a drawing of a phone. The app reads
 * back where it was left on the way in. See `counterPosition` in lib/counting.
 */
export type CounterPosition = { x: number; y: number };

export function isCounterStyle(value: unknown): value is CounterStyle {
  return typeof value === 'string' && (CounterStyles as readonly string[]).includes(value);
}
