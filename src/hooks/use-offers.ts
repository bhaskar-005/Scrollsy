import { useEffect, useSyncExternalStore } from 'react';

import { Pricing } from '@/constants/placeholder';
import { entryPrice, loadOffers, readOffers, subscribeOffers, type Offer } from '@/lib/purchases';

/** Once per launch is enough for a row that only shows a price. */
let asked = false;

/**
 * What is for sale, in this person's own currency. Starts from the last answer
 * the device saw, then asks the store.
 *
 * `fresh` is for the screens that sell: they ask every time they open, since a
 * purchase needs the store's current packages, not whatever was true at launch.
 */
export function useOffers(fresh = false): Offer[] {
  const offers = useSyncExternalStore(subscribeOffers, readOffers, readOffers);

  useEffect(() => {
    if (fresh || !asked) {
      asked = true;
      void loadOffers();
    }
  }, [fresh]);

  return offers;
}

/**
 * The price every "Lock reels at" row leads with. The store's, once it has
 * answered on this device, and the written one before that.
 */
export function useEntryPrice(): string {
  return entryPrice(useOffers()) ?? Pricing.entry;
}
