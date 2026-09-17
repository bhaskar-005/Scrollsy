import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  authFailureStatus,
  isOnboardingStep,
  spanDays,
  emailOf,
  subjectOf,
  toFailure,
  toPreferencePatch,
  toProfile,
  toSession,
  tokenOf,
  type ProfileRow,
} from '../src/contract.ts';

test('database business errors keep their own code and status', () => {
  assert.deepEqual(toFailure({ message: 'friend_cap_inviter', code: 'P0001' }), { status: 409, code: 'friend_cap_inviter' });
  assert.deepEqual(toFailure({ message: 'invite_invalid', code: 'P0001' }), { status: 404, code: 'invite_invalid' });
  assert.deepEqual(toFailure({ message: 'not_authenticated', code: '28000' }), { status: 401, code: 'not_authenticated' });
});

test('an expired or bad token is a 401, not a server error', () => {
  assert.deepEqual(toFailure({ message: 'JWT expired', code: 'PGRST303' }), { status: 401, code: 'not_authenticated' });
  assert.deepEqual(toFailure({ message: 'No suitable key', code: 'PGRST301' }), { status: 401, code: 'not_authenticated' });
});

test('a value the database refuses is a 400', () => {
  assert.deepEqual(toFailure({ code: '23514' }).status, 400);
  assert.deepEqual(toFailure({ code: '22P02' }).status, 400);
});

test('an error message that is an inherited property name is not mistaken for a known code', () => {
  assert.deepEqual(toFailure({ message: 'constructor' }), { status: 500, code: 'server_error' });
  assert.deepEqual(toFailure({ message: 'toString' }), { status: 500, code: 'server_error' });
});

test('onboarding steps are recognised exactly', () => {
  assert.equal(isOnboardingStep('permission'), true);
  assert.equal(isOnboardingStep('done'), true);
  assert.equal(isOnboardingStep('lobby'), false);
  assert.equal(isOnboardingStep('Welcome'), false);
  assert.equal(isOnboardingStep(3), false);
});

test('anything unexpected is a 500 with no detail leaked', () => {
  assert.deepEqual(toFailure({ message: 'relation "x" does not exist', code: '42P01' }), { status: 500, code: 'server_error' });
});

test("Auth refusing a credential signs out, Auth being down does not", () => {
  assert.deepEqual(authFailureStatus(400), 401);
  assert.deepEqual(authFailureStatus(401), 401);
  assert.deepEqual(authFailureStatus(500), 503);
  assert.deepEqual(authFailureStatus(undefined), 503);
});

test('a preference patch maps fields to columns', () => {
  assert.deepEqual(toPreferencePatch({ counterStyle: 'glass', counterPositionX: 0.5 }), {
    counter_style: 'glass',
    counter_position_x: 0.5,
  });
});

test('a patch naming anything else is refused whole, not partly applied', () => {
  assert.deepEqual(toPreferencePatch({ counterStyle: 'glass', premium: true }), null);
  assert.deepEqual(toPreferencePatch({ subscriptionStatus: 'active' }), null);
  assert.deepEqual(toPreferencePatch({}), null);
  assert.deepEqual(toPreferencePatch([]), null);
  assert.deepEqual(toPreferencePatch(null), null);
});

test('span counts both ends', () => {
  assert.deepEqual(spanDays('2026-09-15', '2026-09-15'), 1);
  assert.deepEqual(spanDays('2026-09-09', '2026-09-15'), 7);
  assert.deepEqual(spanDays('2026-09-15', '2026-09-09') < 1, true);
  assert.deepEqual(Number.isNaN(spanDays('nope', '2026-09-15')), true);
});

test('bearer tokens are read strictly', () => {
  assert.deepEqual(tokenOf('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.deepEqual(tokenOf('bearer abc'), 'abc');
  assert.deepEqual(tokenOf('Basic abc'), null);
  assert.deepEqual(tokenOf('Bearer'), null);
  assert.deepEqual(tokenOf(undefined), null);
});

test('the subject comes out of a base64url payload with no padding', () => {
  const payload = btoa(JSON.stringify({ sub: '11111111-1111-4111-8111-111111111111', n: '??>' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  assert.deepEqual(subjectOf(`header.${payload}.signature`), '11111111-1111-4111-8111-111111111111');
  assert.deepEqual(subjectOf('not-a-token'), null);
  assert.deepEqual(subjectOf('a.%%%.c'), null);
});

test('the email comes out of the same payload, and is null when there is none', () => {
  const encode = (claims: object) =>
    btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  assert.deepEqual(emailOf(`header.${encode({ email: 'ravi@example.com' })}.signature`), 'ravi@example.com');
  assert.deepEqual(emailOf(`header.${encode({ sub: 'u1' })}.signature`), null);
  assert.deepEqual(emailOf(`header.${encode({ email: 42 })}.signature`), null);
  assert.deepEqual(emailOf('not-a-token'), null);
});

test('profile and session come out in the app shape', () => {
  const row: ProfileRow = {
    id: 'u1',
    display_name: 'Ravi Menon',
    avatar_url: null,
    daily_limit: 400,
    counter_style: 'pill',
    counter_position_x: 0.86,
    counter_position_y: 0.08,
    notifications_enabled: false,
    screen_time_granted: true,
    overlay_granted: false,
    premium: true,
    subscription_status: 'trialing',
    subscription_expires_at: '2026-09-22T00:00:00Z',
  };
  const profile = toProfile(row, 'ravi@example.com');
  assert.deepEqual(profile.name, 'Ravi Menon');
  assert.deepEqual(profile.email, 'ravi@example.com');
  assert.deepEqual(toProfile(row).email, null);
  assert.deepEqual(profile.counterPosition, { x: 0.86, y: 0.08 });
  assert.deepEqual(profile.subscription, { status: 'trialing', expiresAt: '2026-09-22T00:00:00Z' });
  assert.deepEqual(toSession({ access_token: 'a', refresh_token: 'r', expires_at: 99 }), {
    accessToken: 'a',
    refreshToken: 'r',
    expiresAt: 99,
  });
});
