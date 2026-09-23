/**
 * The shape of what is for sale, and the one sum made from it. Pure, and free
 * of anything native, so it is tested on its own. See test/offers.test.ts.
 */

export type Plan = 'monthly' | 'yearly';

export type Offer = {
  plan: Plan;
  /** What it costs each period once the offer ends, localized by the store. */
  price: string;
  /**
   * The same price as a whole number of micro units, for comparing the two
   * plans without floating point creeping into a percentage.
   */
  amountMicros: number;
  /** What they pay today, when the plan has an introductory phase. */
  entry: { price: string; days: number } | null;
};

/** Below this, a "save" badge is not worth the space it takes. */
const MinimumSaving = 5;

/**
 * How much less a year costs than twelve months of the monthly plan, as a
 * whole percent. Null when there is nothing honest to boast about.
 *
 * Worked out from the store's own numbers rather than written down, because
 * the gap is not the same in every country. At ₹199 and ₹499 it is seventy
 * nine percent. At five dollars and twenty it is sixty seven.
 */
export function yearlySaving(offers: Offer[]): number | null {
  const monthly = offers.find((offer) => offer.plan === 'monthly')?.amountMicros ?? 0;
  const yearly = offers.find((offer) => offer.plan === 'yearly')?.amountMicros ?? 0;
  if (monthly <= 0 || yearly <= 0) {
    return null;
  }

  const saving = Math.round((1 - yearly / (monthly * 12)) * 100);
  return saving >= MinimumSaving ? saving : null;
}

/**
 * The one price every "Lock reels at" row leads with: what the default plan,
 * yearly, costs today. Its introductory price when it has one, its full price
 * when it does not. Null until the store has answered.
 */
export function entryPrice(offers: Offer[]): string | null {
  const yearly = offers.find((offer) => offer.plan === 'yearly');
  return yearly ? (yearly.entry?.price ?? yearly.price) : null;
}

/** A store price in major units, as whole micro units. */
export function toMicros(amount: number): number {
  return Math.round(amount * 1_000_000);
}
