import 'expo-sqlite/localStorage/install';

import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

import { toMicros, type Offer, type Plan } from '@/lib/offers';

export { entryPrice, yearlySaving, type Offer, type Plan } from '@/lib/offers';

/**
 * Buying the plan. The only file that talks to the RevenueCat SDK. The one
 * exception is the onboarding paywall, which draws RevenueCat's own paywall
 * view and hands what it returns back here.
 *
 * RevenueCat does not take the payment. Google Play does, with whatever the
 * person has on their Play account, which in India includes UPI and UPI
 * AutoPay for the recurring part. This reads back what Play charged and who
 * that makes a member.
 *
 * Prices are never written here. They come from the store, already formatted
 * in the buyer's own currency, because the price shown has to be the price
 * charged and only the store knows what that is.
 *
 * The native half only exists in a development build, so it is loaded on the
 * first use rather than imported at the top.
 */

/** The public SDK key for Android, from the RevenueCat dashboard. Safe in the app. */
const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export const purchasesConfigured = Boolean(apiKey);

/** Must match `REVENUECAT_ENTITLEMENT_ID` in the Worker, and the dashboard. */
const EntitlementId = 'pro';

export type PurchaseResult =
  /** Bought. They are a member from this moment. */
  | 'bought'
  /** They closed Google's sheet. Nothing to say about it. */
  | 'cancelled'
  /** No key, no native module, or the store has nothing to sell here. */
  | 'unavailable'
  /** It went wrong. Worth offering another go. */
  | 'failed';

type PurchasesModule = typeof import('react-native-purchases');

let loaded: PurchasesModule | null = null;
let started = false;

async function purchases(): Promise<PurchasesModule | null> {
  if (!apiKey) {
    return null;
  }
  if (!loaded) {
    try {
      loaded = await import('react-native-purchases');
    } catch {
      return null;
    }
  }
  if (!started) {
    started = true;
    if (__DEV__) {
      /** Temporary. Prints the store's own reason when nothing is for sale. */
      void loaded.default.setLogLevel(loaded.LOG_LEVEL.DEBUG);
    }
    loaded.default.configure({ apiKey });
    /**
     * Fires on every change RevenueCat learns about, including a renewal or a
     * cancellation that happened on another device, so the app does not have
     * to ask.
     */
    loaded.default.addCustomerInfoUpdateListener(readEntitlement);
  }
  return loaded;
}

/* -------------------------------------------------------------------------
 * Entitlement, on the device
 *
 * The database is where being a member is decided, through the RevenueCat
 * webhook, and that is what survives a reinstall. But a webhook takes a moment
 * and a person who just paid must not watch a free screen while it lands, so
 * what the store told this device is kept here and counted as well.
 * ---------------------------------------------------------------------- */

const Key = 'premium.entitled';

const listeners = new Set<() => void>();

export function subscribeEntitlement(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isEntitled(): boolean {
  return localStorage.getItem(Key) === 'true';
}

function writeEntitlement(entitled: boolean) {
  if (entitled === isEntitled()) {
    return;
  }
  localStorage.setItem(Key, entitled ? 'true' : 'false');
  listeners.forEach((listener) => listener());
}

function readEntitlement(info: CustomerInfo) {
  writeEntitlement(Boolean(info.entitlements.active[EntitlementId]));
}

/* ------------------------------------------------------------------------- */

/** Days in a billing period, for the terms line. */
function daysIn(period: { unit: string; value: number }): number {
  const perUnit: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };
  return (perUnit[period.unit] ?? 0) * period.value;
}

/** The packages from the last read, so a purchase can name one without asking again. */
const packages = new Map<Plan, PurchasesPackage>();

/* -------------------------------------------------------------------------
 * Offers, cached
 *
 * Several rows across the app lead with a price. They share one read of the
 * store, and the last answer is kept on the device so a cold start shows the
 * real price rather than the written one. A price is only ever shown from
 * here, never bought from here: buying always reads the store again.
 * ---------------------------------------------------------------------- */

const OffersKey = 'offers.cache';

const offerListeners = new Set<() => void>();

function readCachedOffers(): Offer[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(OffersKey) ?? '[]');
    return Array.isArray(parsed) ? (parsed as Offer[]) : [];
  } catch {
    return [];
  }
}

/** Kept as one array, so a subscriber sees the same object until it really changes. */
let lastOffers: Offer[] = readCachedOffers();

export function subscribeOffers(listener: () => void): () => void {
  offerListeners.add(listener);
  return () => {
    offerListeners.delete(listener);
  };
}

export function readOffers(): Offer[] {
  return lastOffers;
}

function writeOffers(offers: Offer[]) {
  lastOffers = offers;
  localStorage.setItem(OffersKey, JSON.stringify(offers));
  offerListeners.forEach((listener) => listener());
}

function toOffer(plan: Plan, item: PurchasesPackage): Offer {
  const intro = item.product.defaultOption?.introPhase ?? null;

  return {
    plan,
    price: item.product.priceString,
    amountMicros: toMicros(item.product.price),
    entry: intro ? { price: intro.price.formatted, days: daysIn(intro.billingPeriod) } : null,
  };
}

/**
 * What is for sale, in this person's own currency. An empty list means the
 * store had nothing to say, and the screens fall back to their written prices.
 */
export async function loadOffers(): Promise<Offer[]> {
  const module = await purchases();
  if (!module) {
    return [];
  }

  try {
    const offering = (await module.default.getOfferings()).current;
    if (!offering) {
      /** Temporary. No current offering set on the RevenueCat dashboard. */
      if (__DEV__) console.log('offers: no current offering');
      return [];
    }
    if (__DEV__) {
      /** Temporary. Package types have to be MONTHLY and ANNUAL to be read. */
      console.log(
        'offers:',
        offering.identifier,
        offering.availablePackages.map((p) => [p.identifier, p.packageType, p.product.priceString]),
      );
    }

    packages.clear();
    const offers: Offer[] = [];
    for (const item of offering.availablePackages) {
      const plan: Plan | null =
        item.packageType === 'MONTHLY' ? 'monthly' : item.packageType === 'ANNUAL' ? 'yearly' : null;
      if (plan && !packages.has(plan)) {
        packages.set(plan, item);
        offers.push(toOffer(plan, item));
      }
    }
    writeOffers(offers);
    return offers;
  } catch (error) {
    /** Temporary. The store's own reason for having nothing to sell. */
    if (__DEV__) console.log('offers failed:', error);
    return [];
  }
}

/**
 * Configures the SDK before a screen draws RevenueCat's own paywall, which
 * needs it configured first. False when it cannot run here: no key, or no
 * native module in this build.
 */
export async function preparePurchases(): Promise<boolean> {
  return (await purchases()) !== null;
}

/**
 * Records what RevenueCat's paywall handed back after a purchase or restore,
 * the same way `buy` does. True when that makes them a member.
 */
export function recordCustomerInfo(info: CustomerInfo): boolean {
  readEntitlement(info);
  return isEntitled();
}

/** Opens Google's own purchase sheet for one plan, and records what comes back. */
export async function buy(plan: Plan): Promise<PurchaseResult> {
  const module = await purchases();
  const item = packages.get(plan);
  if (!module || !item) {
    return 'unavailable';
  }

  try {
    const { customerInfo } = await module.default.purchasePackage(item);
    readEntitlement(customerInfo);
    return isEntitled() ? 'bought' : 'failed';
  } catch (error) {
    return (error as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'failed';
  }
}

/**
 * Asks the store what this account already owns. Play hands a subscription
 * back on its own after a reinstall, so this is for the person who is sure
 * they paid and is looking at a screen that disagrees.
 */
export async function restore(): Promise<boolean> {
  const module = await purchases();
  if (!module) {
    return false;
  }

  try {
    readEntitlement(await module.default.restorePurchases());
    return isEntitled();
  } catch {
    return false;
  }
}

/**
 * Ties purchases to the account, so the webhook can find the row to mark and
 * so a plan follows the person to a new phone. Called once there is an id,
 * which is after the first read of the account.
 */
export async function identifyCustomer(userId: string): Promise<void> {
  const module = await purchases();
  if (!module || !userId) {
    return;
  }

  try {
    const { customerInfo } = await module.default.logIn(userId);
    readEntitlement(customerInfo);
  } catch {
    // Offline. RevenueCat keeps the id and sends it when it can.
  }
}

/** Signing out. The next person on this phone is not a member by inheritance. */
export async function forgetCustomer(): Promise<void> {
  writeEntitlement(false);

  const module = await purchases();
  if (!module) {
    return;
  }

  try {
    await module.default.logOut();
  } catch {
    // Already anonymous, or no native module.
  }
}

/** Brings the entitlement up to date at launch. */
export async function startPurchases(): Promise<void> {
  const module = await purchases();
  if (!module) {
    return;
  }

  try {
    readEntitlement(await module.default.getCustomerInfo());
  } catch {
    // Offline. What the device last knew stands.
  }
}
