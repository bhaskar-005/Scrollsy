/**
 * The real app against a fake database, with real tokens.
 *
 * Tokens here are signed for real with `jose` and verified by the app's own
 * `verifiedUserId`, because that check is now the only gate in front of every
 * route. Stubbing it would be testing the stub.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { SignJWT } from 'jose';

import { createApp } from '../src/index.ts';
import type { Env, RateLimiter } from '../src/env.ts';
import type { OnboardingRow } from '../src/rules.ts';
import type { AcceptOutcome, BoardMember, ProfileRecord, Store, SubscriptionState } from '../src/store.ts';

const SupabaseUrl = 'https://db.test';
const JwtSecret = 'a-test-signing-secret-that-is-long-enough';
const userId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const installId = '33333333-3333-4333-8333-333333333333';

async function signToken(over: { sub?: string; issuer?: string; audience?: string; secret?: string } = {}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(over.sub ?? userId)
    .setIssuer(over.issuer ?? `${SupabaseUrl}/auth/v1`)
    .setAudience(over.audience ?? 'authenticated')
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(over.secret ?? JwtSecret));
}

const profile = (over: Partial<ProfileRecord> = {}): ProfileRecord => ({
  id: userId,
  displayName: 'Ravi Menon',
  avatarUrl: null,
  dailyLimit: 400,
  counterStyle: 'pill',
  counterPositionX: 0.86,
  counterPositionY: 0.08,
  notificationsEnabled: false,
  screenTimeGranted: false,
  overlayGranted: false,
  premium: false,
  subscriptionStatus: 'none',
  subscriptionExpiresAt: null,
  inviteCode: null,
  inviteExpiresAt: null,
  ...over,
});

/** Records what the routes asked of the database, so the tests can check it. */
function fakeStore(over: Partial<Store> = {}) {
  const calls: { name: string; args: unknown[] }[] = [];
  const track = <T>(name: string, value: T) =>
    (...args: unknown[]) => {
      calls.push({ name, args });
      return Promise.resolve(value) as never;
    };

  const store: Store = {
    profile: track('profile', profile()),
    updatePreferences: track('updatePreferences', profile()),
    addUsage: track('addUsage', undefined),
    usageRange: track('usageRange', []),
    board: track('board', [] as BoardMember[]),
    setInvite: track('setInvite', undefined),
    inviterByCode: track('inviterByCode', null),
    acceptInvite: track('acceptInvite', 'accepted' as AcceptOutcome),
    addFeedback: track('addFeedback', undefined),
    progress: track('progress', [] as (OnboardingRow & { installId: string })[]),
    writeProgress: track('writeProgress', undefined),
    setSubscription: track('setSubscription', undefined),
    ...over,
  };

  return { store, calls, called: (name: string) => calls.filter((call) => call.name === name) };
}

const limiter = (success = true): RateLimiter => ({ limit: async () => ({ success }) });

function makeEnv(over: Partial<Env> = {}): Env {
  return {
    SUPABASE_URL: SupabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
    /** Set, so tokens verify offline instead of fetching a key set. */
    SUPABASE_JWT_SECRET: JwtSecret,
    DATABASE_URL: 'postgresql://unused',
    REVENUECAT_WEBHOOK_AUTH: 'hook-secret',
    REVENUECAT_API_KEY: 'rc-key',
    REVENUECAT_ENTITLEMENT_ID: 'pro',
    USER_LIMIT: limiter(),
    PUBLIC_LIMIT: limiter(),
    ...over,
  };
}

let sent: { url: string; headers: Headers; body: string }[] = [];
let respond: (url: string) => Response = () => new Response('{}', { status: 200 });

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  sent.push({ url: request.url, headers: request.headers, body: request.body ? await request.text() : '' });
  return respond(request.url);
}) as typeof fetch;

beforeEach(() => {
  sent = [];
  respond = () => new Response('{}', { status: 200 });
});

function call(
  store: Store,
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown; env?: Env } = {},
) {
  const app = createApp(() => ({ store, dispose: async () => {} }));
  return app.request(
    `http://api.test${path}`,
    {
      method: init.method ?? 'GET',
      headers: { ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    },
    init.env ?? makeEnv(),
  );
}

const bearer = async (over?: Parameters<typeof signToken>[0]) => ({ Authorization: `Bearer ${await signToken(over)}` });

test('no token, no data', async () => {
  const { store, calls } = fakeStore();
  const response = await call(store, '/v1/me');
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test('a token signed by someone else is refused', async () => {
  const { store, calls } = fakeStore();
  const response = await call(store, '/v1/me', { headers: await bearer({ secret: 'not-our-signing-secret-at-all' }) });
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test('a token from another issuer or audience is refused', async () => {
  const { store } = fakeStore();
  const wrongIssuer = await call(store, '/v1/me', { headers: await bearer({ issuer: 'https://evil.test/auth/v1' }) });
  const wrongAudience = await call(store, '/v1/me', { headers: await bearer({ audience: 'anon' }) });
  assert.equal(wrongIssuer.status, 401);
  assert.equal(wrongAudience.status, 401);
});

test('a valid token reads that account, and only that account', async () => {
  const { store, called } = fakeStore();
  const response = await call(store, '/v1/me', { headers: await bearer() });
  assert.equal(response.status, 200);
  assert.deepEqual(called('profile')[0]?.args, [userId]);

  const body = (await response.json()) as { name: string; counterPosition: unknown; premium: boolean };
  assert.equal(body.name, 'Ravi Menon');
  assert.deepEqual(body.counterPosition, { x: 0.86, y: 0.08 });
  assert.equal(body.premium, false);
});

test('a patch naming premium never reaches the database', async () => {
  const { store, calls } = fakeStore();
  const response = await call(store, '/v1/me', {
    method: 'PATCH',
    headers: await bearer(),
    body: { premium: true },
  });
  assert.equal(response.status, 400);
  assert.equal(calls.filter((c) => c.name === 'updatePreferences').length, 0);
});

test('a patch writes only the fields it named, for the caller only', async () => {
  const { store, called } = fakeStore();
  await call(store, '/v1/me', {
    method: 'PATCH',
    headers: await bearer(),
    body: { counterStyle: 'glass', counterPositionX: 0.5 },
  });
  assert.deepEqual(called('updatePreferences')[0]?.args, [userId, { counterStyle: 'glass', counterPositionX: 0.5 }]);
});

test('a sync writes the rows it kept, and nothing when it kept none', async () => {
  const { store, called } = fakeStore();
  await call(store, '/v1/usage/sync', {
    method: 'POST',
    headers: await bearer(),
    body: { today: '2026-09-16', days: [{ date: '2026-09-16', apps: { instagram: 4, snapchat: 9 } }] },
  });
  assert.deepEqual(called('addUsage')[0]?.args, [userId, [{ date: '2026-09-16', app: 'instagram', reels: 4 }]]);

  const empty = fakeStore();
  const response = await call(empty.store, '/v1/usage/sync', {
    method: 'POST',
    headers: await bearer(),
    body: { days: [] },
  });
  assert.equal(response.status, 204);
  assert.equal(empty.called('addUsage').length, 0);
});

test('history past a week needs Pro, and the account decides, not the request', async () => {
  const free = fakeStore();
  const refused = await call(free.store, '/v1/usage?from=2026-01-01&to=2026-01-31&today=2026-09-16', {
    headers: await bearer(),
  });
  assert.equal(refused.status, 403);
  assert.deepEqual(await refused.json(), { error: 'pro_required' });
  assert.equal(free.called('usageRange').length, 0);

  const paid = fakeStore({ profile: async () => profile({ premium: true }) });
  const allowed = await call(paid.store, '/v1/usage?from=2026-01-01&to=2026-01-31&today=2026-09-16', {
    headers: await bearer(),
  });
  assert.equal(allowed.status, 200);
  assert.equal(paid.called('usageRange').length, 1);
});

test('the board comes back fewest reels first, with you marked', async () => {
  const board: BoardMember[] = [
    { id: userId, name: 'Ravi', avatarUrl: null, premium: false, reels: 338 },
    { id: otherId, name: 'Anya', avatarUrl: null, premium: true, reels: 48 },
  ];
  const { store } = fakeStore({ board: async () => board });
  const response = await call(store, '/v1/leaderboard?date=2026-09-16', { headers: await bearer() });

  const ranked = (await response.json()) as { id: string; isMe: boolean }[];
  assert.deepEqual(
    ranked.map((person) => [person.id, person.isMe]),
    [
      [otherId, false],
      [userId, true],
    ],
  );
});

test('a live invite code is reused, and a stale one replaced', async () => {
  const live = fakeStore({
    profile: async () => profile({ inviteCode: '0123456789ab', inviteExpiresAt: new Date(Date.now() + 5 * 86_400_000) }),
  });
  const reused = await call(live.store, '/v1/invites', { method: 'POST', headers: await bearer() });
  assert.deepEqual(await reused.json(), { code: '0123456789ab' });
  assert.equal(live.called('setInvite').length, 0);

  const stale = fakeStore({
    profile: async () => profile({ inviteCode: '0123456789ab', inviteExpiresAt: new Date(Date.now() + 1000) }),
  });
  const minted = await call(stale.store, '/v1/invites', { method: 'POST', headers: await bearer() });
  const { code } = (await minted.json()) as { code: string };
  assert.match(code, /^[0-9a-f]{12}$/);
  assert.notEqual(code, '0123456789ab');
  assert.equal(stale.called('setInvite').length, 1);
});

test('the invite preview is public, and shows only a name and a photo', async () => {
  const { store } = fakeStore({
    inviterByCode: async () => ({
      id: otherId,
      name: 'Ravi Menon',
      avatarUrl: 'https://g/ravi.png',
      inviteExpiresAt: new Date(Date.now() + 86_400_000),
    }),
  });
  const response = await call(store, '/v1/invites/0123456789ab');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { name: 'Ravi Menon', avatarUrl: 'https://g/ravi.png' });
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=60');
});

test('an expired or unknown invite is a 404, and a malformed one never asks', async () => {
  const expired = fakeStore({
    inviterByCode: async () => ({ id: otherId, name: 'Ravi', avatarUrl: null, inviteExpiresAt: new Date(Date.now() - 1000) }),
  });
  assert.equal((await call(expired.store, '/v1/invites/0123456789ab')).status, 404);

  const malformed = fakeStore();
  assert.equal((await call(malformed.store, '/v1/invites/DROP-TABLE')).status, 404);
  assert.equal(malformed.calls.length, 0);
});

test('a full friend list is refused by the database, and reported as itself', async () => {
  const inviter = {
    id: otherId,
    name: 'Ravi',
    avatarUrl: null,
    inviteExpiresAt: new Date(Date.now() + 86_400_000),
  };
  for (const [outcome, status, error] of [
    ['cap_self', 409, 'friend_cap_self'],
    ['cap_inviter', 409, 'friend_cap_inviter'],
  ] as const) {
    const { store } = fakeStore({ inviterByCode: async () => inviter, acceptInvite: async () => outcome });
    const response = await call(store, '/v1/invites/0123456789ab/accept', { method: 'POST', headers: await bearer() });
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error });
  }
});

test('your own invite is not a friendship', async () => {
  const { store, called } = fakeStore({
    inviterByCode: async () => ({ id: userId, name: 'Me', avatarUrl: null, inviteExpiresAt: new Date(Date.now() + 86_400_000) }),
  });
  const response = await call(store, '/v1/invites/0123456789ab/accept', { method: 'POST', headers: await bearer() });
  assert.equal(response.status, 400);
  assert.equal(called('acceptInvite').length, 0);
});

test('onboarding progress works signed out, and merges rather than overwrites', async () => {
  const existing: OnboardingRow & { installId: string } = {
    installId,
    userId: null,
    currentStep: 'concept',
    furthestStep: 'permission',
    reachedAt: { concept: '2026-09-01T00:00:00.000Z' },
    completedAt: null,
  };
  const { store, called } = fakeStore({ progress: async () => [existing] });

  const response = await call(store, '/v1/onboarding/progress', {
    method: 'POST',
    body: { installId, step: 'concept' },
  });
  assert.equal(response.status, 204);

  const [, written] = called('writeProgress')[0]?.args as [string, OnboardingRow];
  assert.equal(written.currentStep, 'concept');
  assert.equal(written.furthestStep, 'permission');
  assert.equal(written.reachedAt.concept, '2026-09-01T00:00:00.000Z');
});

test("an install that belongs to someone else is not moved", async () => {
  const { store, called } = fakeStore({
    progress: async () => [
      {
        installId,
        userId: otherId,
        currentStep: 'friends',
        furthestStep: 'friends',
        reachedAt: {},
        completedAt: null,
      },
    ],
  });

  const response = await call(store, '/v1/onboarding/progress', {
    method: 'POST',
    headers: await bearer(),
    body: { installId, step: 'welcome' },
  });
  assert.equal(response.status, 204);
  assert.equal(called('writeProgress').length, 0);
});

test('resume reports the furthest step, or nothing for a new install', async () => {
  const known = fakeStore({
    progress: async () => [
      { installId, userId: null, currentStep: 'concept', furthestStep: 'permission', reachedAt: {}, completedAt: null },
    ],
  });
  assert.deepEqual(await (await call(known.store, `/v1/onboarding/progress?installId=${installId}`)).json(), {
    step: 'permission',
    completed: false,
  });

  const fresh = fakeStore();
  assert.deepEqual(await (await call(fresh.store, `/v1/onboarding/progress?installId=${installId}`)).json(), {
    step: null,
    completed: false,
  });
});

test('the webhook refuses a wrong secret, and writes what RevenueCat currently says', async () => {
  const refused = fakeStore();
  const no = await call(refused.store, '/v1/webhooks/revenuecat', {
    method: 'POST',
    headers: { Authorization: 'guess' },
    body: { event: { app_user_id: userId } },
  });
  assert.equal(no.status, 401);
  assert.equal(refused.calls.length, 0);

  respond = (url) =>
    url.startsWith('https://api.revenuecat.com/')
      ? new Response(
          JSON.stringify({
            subscriber: {
              entitlements: {
                pro: { expires_date: '2099-01-01T00:00:00Z', grace_period_expires_date: null, product_identifier: 'pro_yearly' },
              },
              subscriptions: { pro_yearly: { period_type: 'trial', store: 'play_store', unsubscribe_detected_at: null } },
            },
          }),
          { status: 200 },
        )
      : new Response('{}', { status: 200 });

  const { store, called } = fakeStore();
  const ok = await call(store, '/v1/webhooks/revenuecat', {
    method: 'POST',
    headers: { Authorization: 'hook-secret' },
    body: { event: { type: 'INITIAL_PURCHASE', app_user_id: userId } },
  });
  assert.equal(ok.status, 200);

  const [written, state] = called('setSubscription')[0]?.args as [string, SubscriptionState];
  assert.equal(written, userId);
  assert.equal(state.status, 'trialing');
  assert.equal(state.productId, 'pro_yearly');
});

test('over the limit is a 429, before the database is touched', async () => {
  const { store, calls } = fakeStore();
  const response = await call(store, '/v1/me', {
    headers: await bearer(),
    env: makeEnv({ USER_LIMIT: limiter(false) }),
  });
  assert.equal(response.status, 429);
  assert.equal(calls.length, 0);
});

test('unknown paths, and anything outside /v1, are not found', async () => {
  const { store } = fakeStore();
  assert.equal((await call(store, '/v1/nowhere')).status, 404);
  assert.equal((await call(store, '/me', { headers: await bearer() })).status, 404);
});
