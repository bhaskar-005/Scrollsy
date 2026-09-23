/**
 * Turns RevenueCat's current record of a customer into the row
 * `apply_subscription` stores. Pure, so it is tested on its own.
 */

export type Status = 'trialing' | 'active' | 'canceled' | 'expired';

export type EntitlementState = {
  status: Status;
  productId: string | null;
  store: string | null;
  /** Null for a purchase that never runs out. */
  expiresAt: string | null;
};

/** The parts of `GET /v1/subscribers/{id}` this function reads. */
export type Subscriber = {
  entitlements?: Record<
    string,
    {
      expires_date: string | null;
      grace_period_expires_date: string | null;
      product_identifier: string;
    }
  >;
  subscriptions?: Record<
    string,
    {
      period_type: string;
      store: string;
      unsubscribe_detected_at: string | null;
    }
  >;
};

/** The ids a webhook event can touch. A transfer names both sides of it. */
export type RevenueCatEvent = {
  app_user_id?: unknown;
  original_app_user_id?: unknown;
  aliases?: unknown;
  transferred_from?: unknown;
  transferred_to?: unknown;
};

const Uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every Supabase account id the event mentions. RevenueCat's anonymous ids,
 * and anything else that is not one of our accounts, are dropped here.
 */
export function affectedUsers(event: RevenueCatEvent): string[] {
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...(Array.isArray(event.aliases) ? event.aliases : []),
    ...(Array.isArray(event.transferred_from) ? event.transferred_from : []),
    ...(Array.isArray(event.transferred_to) ? event.transferred_to : []),
  ];

  return [...new Set(candidates.filter((id): id is string => typeof id === 'string' && Uuid.test(id)))];
}

export function entitlementState(
  subscriber: Subscriber,
  entitlementId: string,
  now = Date.now(),
): EntitlementState {
  const entitlement = subscriber.entitlements?.[entitlementId];

  if (!entitlement) {
    return { status: 'expired', productId: null, store: null, expiresAt: null };
  }

  const subscription = subscriber.subscriptions?.[entitlement.product_identifier];
  const lifetime = entitlement.expires_date === null;

  /** A billing grace period keeps access past the nominal expiry, so take the later of the two. */
  const endsAt = lifetime
    ? null
    : Math.max(
        ...[entitlement.expires_date, entitlement.grace_period_expires_date]
          .filter((date): date is string => typeof date === 'string')
          .map((date) => Date.parse(date)),
      );

  const base = {
    productId: entitlement.product_identifier,
    store: subscription?.store ?? null,
    expiresAt: endsAt === null ? null : new Date(endsAt).toISOString(),
  };

  if (endsAt !== null && endsAt <= now) {
    return { status: 'expired', ...base };
  }

  /** The paid first week counts as the trial, same as in api/. */
  if (subscription?.period_type === 'trial' || subscription?.period_type === 'intro') {
    return { status: 'trialing', ...base };
  }

  if (subscription?.unsubscribe_detected_at) {
    return { status: 'canceled', ...base };
  }

  return { status: 'active', ...base };
}
