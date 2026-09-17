/**
 * The real app, routed end to end, with `fetch` stubbed so no request leaves
 * the machine. Checks what each route sends to Supabase and RevenueCat, whose
 * token it forwards, and what the caller gets back.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import app from '../src/index.ts';
import type { Env, RateLimiter } from '../src/env.ts';

type Sent = { url: string; method: string; headers: Headers; body: string };

let sent: Sent[] = [];
let respond: (request: Sent) => Response = () => new Response(null, { status: 204 });

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  const record = {
    url: request.url,
    method: request.method,
    headers: request.headers,
    body: request.body ? await request.text() : '',
  };
  sent.push(record);
  return respond(record);
}) as typeof fetch;

beforeEach(() => {
  sent = [];
  respond = () => new Response(null, { status: 204 });
});

function limiter(success = true): RateLimiter & { keys: string[] } {
  const keys: string[] = [];
  return {
    keys,
    async limit({ key }) {
      keys.push(key);
      return { success };
    },
  };
}

/** A fresh env per test, so the per isolate client cache never leaks between tests. */
function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    SUPABASE_URL: 'https://db.test',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
    REVENUECAT_WEBHOOK_AUTH: 'hook-secret',
    REVENUECAT_API_KEY: 'rc-key',
    REVENUECAT_ENTITLEMENT_ID: 'pro',
    USER_LIMIT: limiter(),
    PUBLIC_LIMIT: limiter(),
    ...overrides,
  };
}

const userId = '11111111-1111-4111-8111-111111111111';
const installId = '22222222-2222-4222-8222-222222222222';
const payload = btoa(JSON.stringify({ sub: userId })).replace(/=+$/, '');
const token = `header.${payload}.signature`;
const bearer = { Authorization: `Bearer ${token}` };

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function call(env: Env, path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  return app.request(
    `http://api.test${path}`,
    {
      method: init.method ?? 'GET',
      headers: { ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
      body: init.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
    },
    env,
  );
}

test('a protected route with no token is refused before anything is called', async () => {
  const response = await call(makeEnv(), '/v1/me');
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'not_authenticated' });
  assert.equal(sent.length, 0);
});

test('usage sync forwards the caller token to increment_usage, in one call', async () => {
  const days = [{ date: '2026-09-15', apps: { instagram: 4 } }];
  const response = await call(makeEnv(), '/v1/usage/sync', { method: 'POST', headers: bearer, body: { days } });

  assert.equal(response.status, 204);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.url, 'https://db.test/rest/v1/rpc/increment_usage');
  assert.equal(sent[0]!.headers.get('Authorization'), `Bearer ${token}`);
  assert.deepEqual(JSON.parse(sent[0]!.body), { p_days: days });
});

test('an empty sync costs no database call', async () => {
  const response = await call(makeEnv(), '/v1/usage/sync', { method: 'POST', headers: bearer, body: { days: [] } });
  assert.equal(response.status, 204);
  assert.equal(sent.length, 0);
});

test('a database business error keeps its code and its meaning', async () => {
  respond = () => jsonResponse({ code: 'P0001', message: 'friend_cap_inviter', details: null, hint: null }, 400);
  const response = await call(makeEnv(), '/v1/invites/0123456789ab/accept', { method: 'POST', headers: bearer });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'friend_cap_inviter' });
});

test('an unexpected database error answers with no detail', async () => {
  respond = () => jsonResponse({ code: '42P01', message: 'relation "secret_table" does not exist' }, 500);
  const response = await call(makeEnv(), '/v1/me', { headers: bearer });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'server_error' });
});

test('over the limit is a 429, and the limit is never keyed on the forgeable user id', async () => {
  const env = makeEnv({ USER_LIMIT: limiter(false) });
  const response = await call(env, '/v1/leaderboard?date=2026-09-15', { headers: bearer });
  assert.equal(response.status, 429);
  assert.equal(sent.length, 0);

  const [key] = (env.USER_LIMIT as ReturnType<typeof limiter>).keys;
  assert.ok(key && key !== userId && key !== token);
});

test('onboarding progress works signed out, as anon, limited per install', async () => {
  const env = makeEnv();
  const response = await call(env, '/v1/onboarding/progress', {
    method: 'POST',
    body: { installId, step: 'concept' },
  });

  assert.equal(response.status, 204);
  assert.equal(sent[0]!.url, 'https://db.test/rest/v1/rpc/record_onboarding_step');
  assert.notEqual(sent[0]!.headers.get('Authorization'), `Bearer ${token}`);
  assert.deepEqual(JSON.parse(sent[0]!.body), { p_install_id: installId, p_step: 'concept' });
  assert.deepEqual((env.PUBLIC_LIMIT as ReturnType<typeof limiter>).keys, [`install:${installId}`]);
});

test('onboarding progress with a token acts as that person, which links the install', async () => {
  await call(makeEnv(), '/v1/onboarding/progress', {
    method: 'POST',
    headers: bearer,
    body: { installId, step: 'notifications' },
  });
  assert.equal(sent[0]!.headers.get('Authorization'), `Bearer ${token}`);
});

test('a made up step or install id never reaches the database', async () => {
  const env = makeEnv();
  const badStep = await call(env, '/v1/onboarding/progress', { method: 'POST', body: { installId, step: 'lobby' } });
  const badId = await call(env, '/v1/onboarding/progress', { method: 'POST', body: { installId: 'me', step: 'welcome' } });
  assert.equal(badStep.status, 400);
  assert.equal(badId.status, 400);
  assert.equal(sent.length, 0);
});

test('resume returns the step to pick up from, or null for a new install', async () => {
  respond = () => jsonResponse([{ step: 'permission', completed: false }]);
  const known = await call(makeEnv(), `/v1/onboarding/progress?installId=${installId}`);
  assert.deepEqual(await known.json(), { step: 'permission', completed: false });

  respond = () => jsonResponse([]);
  const fresh = await call(makeEnv(), `/v1/onboarding/progress?installId=${installId}`);
  assert.deepEqual(await fresh.json(), { step: null, completed: false });
});

test('a preference patch naming premium is refused without a query', async () => {
  const response = await call(makeEnv(), '/v1/me', { method: 'PATCH', headers: bearer, body: { premium: true } });
  assert.equal(response.status, 400);
  assert.equal(sent.length, 0);
});

test('the leaderboard comes back in the app shape', async () => {
  respond = () =>
    jsonResponse([
      { id: userId, display_name: 'Ravi', avatar_url: null, premium: true, reels: 48, is_me: true },
    ]);
  const response = await call(makeEnv(), '/v1/leaderboard?date=2026-09-15', { headers: bearer });
  assert.deepEqual(await response.json(), [
    { id: userId, name: 'Ravi', avatarUrl: null, premium: true, reels: 48, isMe: true },
  ]);
  assert.deepEqual(JSON.parse(sent[0]!.body), { p_date: '2026-09-15' });
});

test('the webhook refuses a wrong secret without calling anyone', async () => {
  const response = await call(makeEnv(), '/v1/webhooks/revenuecat', {
    method: 'POST',
    headers: { Authorization: 'guess' },
    body: { event: { app_user_id: userId } },
  });
  assert.equal(response.status, 401);
  assert.equal(sent.length, 0);
});

test('the webhook re-reads RevenueCat, then writes with the admin key', async () => {
  respond = (request) =>
    request.url.startsWith('https://api.revenuecat.com/')
      ? jsonResponse({
          subscriber: {
            entitlements: {
              pro: { expires_date: '2099-01-01T00:00:00Z', grace_period_expires_date: null, product_identifier: 'pro_yearly' },
            },
            subscriptions: {
              pro_yearly: { period_type: 'trial', store: 'play_store', unsubscribe_detected_at: null },
            },
          },
        })
      : new Response(null, { status: 204 });

  const response = await call(makeEnv(), '/v1/webhooks/revenuecat', {
    method: 'POST',
    headers: { Authorization: 'hook-secret' },
    body: { event: { type: 'INITIAL_PURCHASE', app_user_id: userId, aliases: ['$RCAnonymousID:x'] } },
  });

  assert.equal(response.status, 200);
  assert.equal(sent[0]!.url, `https://api.revenuecat.com/v1/subscribers/${userId}`);
  assert.equal(sent[0]!.headers.get('Authorization'), 'Bearer rc-key');
  assert.equal(sent[1]!.url, 'https://db.test/rest/v1/rpc/apply_subscription');
  assert.equal(sent[1]!.headers.get('apikey'), 'sb_secret_test');
  assert.deepEqual(JSON.parse(sent[1]!.body), {
    p_user: userId,
    p_status: 'trialing',
    p_product_id: 'pro_yearly',
    p_store: 'play_store',
    p_expires_at: '2099-01-01T00:00:00.000Z',
  });
});

test('an oversized body is refused before any route runs', async () => {
  const response = await call(makeEnv(), '/v1/usage/sync', {
    method: 'POST',
    headers: bearer,
    body: JSON.stringify({ days: [], padding: 'x'.repeat(70 * 1024) }),
  });
  assert.equal(response.status, 413);
  assert.equal(sent.length, 0);
});

test('the invite preview is public, returns only a name and photo, and caches briefly', async () => {
  respond = () => jsonResponse([{ name: 'Ravi Menon', avatar_url: 'https://g/ravi.png' }]);
  const env = makeEnv();
  const response = await call(env, '/v1/invites/0123456789ab');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { name: 'Ravi Menon', avatarUrl: 'https://g/ravi.png' });
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=60');
  assert.equal(sent[0]!.url, 'https://db.test/rest/v1/rpc/invite_preview');
  assert.deepEqual((env.PUBLIC_LIMIT as ReturnType<typeof limiter>).keys, ['invite:0123456789ab']);
});

test('an expired or unknown invite is a 404, and a malformed one never reaches the database', async () => {
  respond = () => jsonResponse([]);
  assert.equal((await call(makeEnv(), '/v1/invites/0123456789ab')).status, 404);

  sent = [];
  assert.equal((await call(makeEnv(), '/v1/invites/DROP-TABLE')).status, 404);
  assert.equal(sent.length, 0);
});

test('creating an invite still needs sign in, though its preview does not', async () => {
  assert.equal((await call(makeEnv(), '/v1/invites', { method: 'POST' })).status, 401);
  assert.equal((await call(makeEnv(), '/v1/invites/0123456789ab/accept', { method: 'POST' })).status, 401);
});

test('unknown paths, and anything outside /v1, are not found', async () => {
  assert.equal((await call(makeEnv(), '/v1/nowhere')).status, 404);
  assert.equal((await call(makeEnv(), '/me', { headers: bearer })).status, 404);
});
