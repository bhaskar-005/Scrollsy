import assert from 'node:assert/strict';
import { test } from 'node:test';

import { affectedUsers, entitlementState, type Subscriber } from '../src/entitlement.ts';

const now = Date.parse('2026-09-15T12:00:00Z');
const future = '2026-10-15T12:00:00Z';
const past = '2026-09-01T12:00:00Z';

const subscriber = (
  entitlement: { expires_date: string | null; grace_period_expires_date?: string | null },
  subscription: { period_type?: string; unsubscribe_detected_at?: string | null } = {},
): Subscriber => ({
  entitlements: {
    pro: {
      expires_date: entitlement.expires_date,
      grace_period_expires_date: entitlement.grace_period_expires_date ?? null,
      product_identifier: 'pro_yearly',
    },
  },
  subscriptions: {
    pro_yearly: {
      period_type: subscription.period_type ?? 'normal',
      store: 'play_store',
      unsubscribe_detected_at: subscription.unsubscribe_detected_at ?? null,
    },
  },
});

test('no entitlement at all is expired', () => {
  assert.deepEqual(entitlementState({}, 'pro', now), {
    status: 'expired',
    productId: null,
    store: null,
    expiresAt: null,
  });
});

test('a paying subscription is active', () => {
  assert.deepEqual(entitlementState(subscriber({ expires_date: future }), 'pro', now), {
    status: 'active',
    productId: 'pro_yearly',
    store: 'play_store',
    expiresAt: new Date(future).toISOString(),
  });
});

test('a free trial is trialing', () => {
  const state = entitlementState(subscriber({ expires_date: future }, { period_type: 'trial' }), 'pro', now);
  assert.deepEqual(state.status, 'trialing');
});

test('cancelled but still paid up is canceled, not expired', () => {
  const state = entitlementState(
    subscriber({ expires_date: future }, { unsubscribe_detected_at: past }),
    'pro',
    now,
  );
  assert.deepEqual(state.status, 'canceled');
});

test('past its expiry is expired', () => {
  const state = entitlementState(subscriber({ expires_date: past }), 'pro', now);
  assert.deepEqual(state.status, 'expired');
});

test('a billing grace period keeps access past the nominal expiry', () => {
  const state = entitlementState(
    subscriber({ expires_date: past, grace_period_expires_date: future }),
    'pro',
    now,
  );
  assert.deepEqual(state.status, 'active');
  assert.deepEqual(state.expiresAt, new Date(future).toISOString());
});

test('a purchase with no expiry never runs out', () => {
  const state = entitlementState(subscriber({ expires_date: null }), 'pro', now);
  assert.deepEqual(state.status, 'active');
  assert.deepEqual(state.expiresAt, null);
});

test('a different entitlement id is not ours', () => {
  const state = entitlementState(subscriber({ expires_date: future }), 'gold', now);
  assert.deepEqual(state.status, 'expired');
});

test('affected users keeps our account ids and drops everything else', () => {
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  assert.deepEqual(
    affectedUsers({
      app_user_id: a,
      original_app_user_id: '$RCAnonymousID:abc123',
      aliases: [a, '$RCAnonymousID:abc123', 42],
      transferred_from: [b],
      transferred_to: 'not a list',
    }),
    [a, b],
  );
});
