/**
 * The floating counter's own settings. The style list matches the check
 * constraint on `profiles`, so anything the picker can produce is something
 * the database will accept.
 */

export const CounterStyles = ['pill', 'outline', 'glass', 'plain', 'mascot'] as const;
export type CounterStyle = (typeof CounterStyles)[number];

/**
 * Where it sits over the screen, as a fraction of width and height. Nothing in
 * the app sets this now: the counter keeps the default corner, and the overlay
 * itself will be draggable once it exists, which is a better place to choose
 * than a drawing of a phone. The columns stay, so a choice made there persists.
 */
export type CounterPosition = { x: number; y: number };

export function isCounterStyle(value: unknown): value is CounterStyle {
  return typeof value === 'string' && (CounterStyles as readonly string[]).includes(value);
}
