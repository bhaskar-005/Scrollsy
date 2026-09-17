/**
 * The rules that used to be SQL. In the other backend the database enforced
 * these and `supabase/tests` proved it. Here they are ordinary code, so this is
 * the only thing standing between a mistake and an open door.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  friendCapReached,
  furthestOf,
  historyAllowed,
  inviteIsLive,
  mayWriteProgress,
  mergeProgress,
  needsFreshInvite,
  newInviteCode,
  toPreferencePatch,
  toUsageRows,
  type OnboardingRow,
} from '../src/rules.ts';

const today = '2026-09-16';

test('a sync keeps what it can use', () => {
  const rows = toUsageRows(
    [
      { date: today, apps: { instagram: 10, tiktok: 5 } },
      { date: '2026-09-15', apps: { youtube: 3 } },
    ],
    today,
  );
  assert.deepEqual(rows, [
    { date: today, app: 'instagram', reels: 10 },
    { date: today, app: 'tiktok', reels: 5 },
    { date: '2026-09-15', app: 'youtube', reels: 3 },
  ]);
});

test('and drops what it cannot, rather than refusing the batch', () => {
  const rows = toUsageRows(
    [
      { date: '2026-08-01', apps: { instagram: 9 } }, // too old
      { date: '2026-09-30', apps: { instagram: 9 } }, // a wrong clock
      { date: today, apps: { snapchat: 9, tiktok: -4, youtube: 'lots' } },
      { date: 'nonsense', apps: { instagram: 9 } },
      { apps: { instagram: 9 } },
      { date: today, apps: { instagram: 999999 } }, // clamped
    ],
    today,
  );
  assert.deepEqual(rows, [{ date: today, app: 'instagram', reels: 5000 }]);
});

test('an absurd batch is ignored whole', () => {
  assert.deepEqual(toUsageRows(Array.from({ length: 40 }, () => ({ date: today, apps: { tiktok: 1 } })), today), []);
  assert.deepEqual(toUsageRows('nope', today), []);
  assert.deepEqual(toUsageRows(null, today), []);
});

test('free accounts see a week, Pro sees all of it', () => {
  assert.equal(historyAllowed('2026-09-10', false, today), true);
  assert.equal(historyAllowed('2026-09-09', false, today), false);
  assert.equal(historyAllowed('2020-01-01', true, today), true);
});

test('a patch may name preferences and nothing else', () => {
  assert.deepEqual(toPreferencePatch({ counterStyle: 'glass', counterPositionX: 0.5 }), {
    counterStyle: 'glass',
    counterPositionX: 0.5,
  });
  assert.equal(toPreferencePatch({ premium: true }), null);
  assert.equal(toPreferencePatch({ subscriptionStatus: 'active' }), null);
  assert.equal(toPreferencePatch({ inviteCode: 'mine' }), null);
  assert.equal(toPreferencePatch({ counterStyle: 'glass', premium: true }), null);
  assert.equal(toPreferencePatch({}), null);
  assert.equal(toPreferencePatch([]), null);
});

test('a patch with a value the old constraints refused is refused here too', () => {
  assert.equal(toPreferencePatch({ counterStyle: 'neon' }), null);
  assert.equal(toPreferencePatch({ dailyLimit: 0 }), null);
  assert.equal(toPreferencePatch({ dailyLimit: 99999 }), null);
  assert.equal(toPreferencePatch({ counterPositionX: 1.5 }), null);
  assert.equal(toPreferencePatch({ notificationsEnabled: 'yes' }), null);
});

test('invite codes look like the ones the database made', () => {
  const code = newInviteCode();
  assert.match(code, /^[0-9a-f]{12}$/);
  assert.notEqual(code, newInviteCode());
});

test('an invite is live until it is not', () => {
  const now = new Date('2026-09-16T12:00:00Z');
  assert.equal(inviteIsLive(new Date('2026-09-17T12:00:00Z'), now), true);
  assert.equal(inviteIsLive(new Date('2026-09-16T11:00:00Z'), now), false);
  assert.equal(inviteIsLive(null, now), false);
});

test('a code with less than a day left is replaced, not reused', () => {
  const now = new Date('2026-09-16T12:00:00Z');
  assert.equal(needsFreshInvite(new Date('2026-09-20T12:00:00Z'), now), false);
  assert.equal(needsFreshInvite(new Date('2026-09-17T01:00:00Z'), now), true);
  assert.equal(needsFreshInvite(null, now), true);
});

test('five friends is the free ceiling, and Pro has none', () => {
  assert.equal(friendCapReached(false, 4), false);
  assert.equal(friendCapReached(false, 5), true);
  assert.equal(friendCapReached(true, 50), false);
});

const progress = (over: Partial<OnboardingRow> = {}): OnboardingRow => ({
  userId: null,
  currentStep: 'concept',
  furthestStep: 'concept',
  reachedAt: { welcome: '2026-09-01T00:00:00.000Z', concept: '2026-09-02T00:00:00.000Z' },
  completedAt: null,
  ...over,
});

test('progress moves forward and never back', () => {
  const now = new Date('2026-09-16T12:00:00Z');
  const forward = mergeProgress(progress(), 'permission', null, now);
  assert.equal(forward.furthestStep, 'permission');

  const back = mergeProgress(progress({ furthestStep: 'paywall' }), 'welcome', null, now);
  assert.equal(back.currentStep, 'welcome');
  assert.equal(back.furthestStep, 'paywall');
});

test('the first time a step was reached is never overwritten', () => {
  const merged = mergeProgress(progress(), 'concept', null, new Date('2026-09-16T12:00:00Z'));
  assert.equal(merged.reachedAt.concept, '2026-09-02T00:00:00.000Z');
  assert.equal(merged.reachedAt.welcome, '2026-09-01T00:00:00.000Z');
});

test('finishing is stamped once, and signing in links the install', () => {
  const now = new Date('2026-09-16T12:00:00Z');
  const done = mergeProgress(progress(), 'done', 'user-1', now);
  assert.equal(done.completedAt?.toISOString(), now.toISOString());
  assert.equal(done.userId, 'user-1');

  const again = mergeProgress({ ...done, furthestStep: 'done' }, 'done', 'user-1', new Date('2026-09-17T12:00:00Z'));
  assert.equal(again.completedAt?.toISOString(), now.toISOString());
});

test('an install that belongs to an account is only theirs to move', () => {
  assert.equal(mayWriteProgress(null, null), true);
  assert.equal(mayWriteProgress(progress(), 'user-1'), true);
  assert.equal(mayWriteProgress(progress({ userId: 'user-1' }), 'user-1'), true);
  assert.equal(mayWriteProgress(progress({ userId: 'user-1' }), 'user-2'), false);
  assert.equal(mayWriteProgress(progress({ userId: 'user-1' }), null), false);
});

test('resume takes the furthest across every install of an account', () => {
  assert.deepEqual(
    furthestOf([progress({ furthestStep: 'concept' }), progress({ furthestStep: 'friends' })]),
    { step: 'friends', completed: false },
  );
  assert.deepEqual(
    furthestOf([progress({ furthestStep: 'done', completedAt: new Date() })]),
    { step: 'done', completed: true },
  );
  assert.equal(furthestOf([]), null);
});
