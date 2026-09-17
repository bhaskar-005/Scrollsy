import { Hono } from 'hono';

import { adminClient } from '../clients.ts';
import { affectedUsers, entitlementState, type RevenueCatEvent, type Subscriber } from '../entitlement.ts';
import type { AppEnv, Env } from '../env.ts';

/** Compares in constant time, so response timing reveals nothing about the secret. */
function sameSecret(given: string, expected: string) {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a[i]! ^ b[i]!;
  }
  return difference === 0;
}

async function fetchSubscriber(env: Env, appUserId: string): Promise<Subscriber> {
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${env.REVENUECAT_API_KEY}` },
  });
  if (!response.ok) {
    throw new Error(`RevenueCat responded ${response.status}`);
  }
  return ((await response.json()) as { subscriber?: Subscriber }).subscriber ?? {};
}

export const webhooks = new Hono<AppEnv>()
  /**
   * RevenueCat calls this when a purchase changes. The event is treated as a
   * ping, not as data: for every account it names, the current state is read
   * back from RevenueCat and written. Late, repeated and out of order events
   * all end in the same state, which is what RevenueCat itself recommends.
   *
   * RevenueCat sends no user token, so its shared secret is the only gate.
   */
  .post('/revenuecat', async (c) => {
    const expected = c.env.REVENUECAT_WEBHOOK_AUTH;
    if (!expected || !sameSecret(c.req.header('Authorization') ?? '', expected)) {
      return c.json({ error: 'unauthorized' }, 401);
    }

    const payload: unknown = await c.req.json().catch(() => null);
    const event = (payload as { event?: RevenueCatEvent } | null)?.event;
    if (!event || typeof event !== 'object') {
      return c.json({ error: 'invalid_request' }, 400);
    }

    const admin = adminClient(c.env);
    for (const userId of affectedUsers(event)) {
      const state = entitlementState(await fetchSubscriber(c.env, userId), c.env.REVENUECAT_ENTITLEMENT_ID);
      const { error } = await admin.rpc('apply_subscription', {
        p_user: userId,
        p_status: state.status,
        p_product_id: state.productId,
        p_store: state.store,
        p_expires_at: state.expiresAt,
      });
      if (error) {
        // Anything but a 200 makes RevenueCat retry, which a failure here wants.
        console.error('revenuecat webhook', error);
        return c.json({ error: 'sync_failed' }, 500);
      }
    }

    return c.json({ ok: true });
  });
