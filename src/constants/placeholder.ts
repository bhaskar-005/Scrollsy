/**
 * What is still invented. Everything else the screens show now comes from the
 * device's own store or the API.
 *
 * Prices are the last of it. They belong to the store, and RevenueCat hands us
 * the store's own localized price string once payments are wired, which is
 * stage 4.
 */
import { getLocales } from 'expo-localization';

/**
 * The head to head preview in onboarding. You are ahead, because the whole
 * point of the screen is daring someone to come at that number. There is no
 * friend yet at that point in the flow, so both numbers are drawn, not read.
 */
export const InviteDuel = {
  you: 20,
  friend: 64,
};

/** One for now. The picker is built so the rest just drop in. */
export const Languages = [{ id: 'en', label: 'English' }] as const;

/**
 * What a price row says before the store has ever answered on this device.
 *
 * The entry offer is on the yearly plan only. `entryDays` for `entry`, then
 * `yearly` once a year. Monthly is its full price from the first day.
 *
 * The real price always comes from the store, through RevenueCat, formatted in
 * the buyer's own currency. These only fill the gap on a first launch with no
 * connection, and they match what is configured in Play Console, so the gap
 * does not show a different number from the one that follows it.
 *
 * The phone's currency only approximates the Play account's country, which is
 * what actually decides the price. Change these and Play Console together.
 */
const inRupees = getLocales()[0]?.currencyCode === 'INR';

export const Pricing = inRupees
  ? {
      /**
       * The entry offer. Play's floor in India is about ten rupees, so check
       * Play Console accepts this before launch. See docs/payments-setup.md.
       */
      entry: '₹1',
      entryDays: 14,
      monthly: '₹199',
      yearly: '₹499',
    }
  : {
      entry: '$1',
      entryDays: 14,
      monthly: '$5',
      yearly: '$19.99',
    };
