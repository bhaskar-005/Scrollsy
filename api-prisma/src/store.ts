import type { OnboardingRow, PreferencePatch, UsageRow } from './rules.ts';

/**
 * Everything the routes need from the database, and nothing about Prisma. The
 * routes hold the rules, this holds the reads and writes, and the tests use a
 * fake of this to check the rules without a database anywhere near them.
 */

export type ProfileRecord = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  dailyLimit: number;
  counterStyle: string;
  counterPositionX: number;
  counterPositionY: number;
  notificationsEnabled: boolean;
  screenTimeGranted: boolean;
  overlayGranted: boolean;
  premium: boolean;
  subscriptionStatus: string;
  subscriptionExpiresAt: Date | null;
  inviteCode: string | null;
  inviteExpiresAt: Date | null;
};

export type BoardMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  premium: boolean;
  reels: number;
};

export type InviterRecord = {
  id: string;
  name: string;
  avatarUrl: string | null;
  inviteExpiresAt: Date | null;
};

export type AcceptOutcome = 'accepted' | 'already_friends' | 'cap_self' | 'cap_inviter';

export type SubscriptionState = {
  status: string;
  productId: string | null;
  store: string | null;
  expiresAt: string | null;
};

export interface Store {
  profile(userId: string): Promise<ProfileRecord | null>;
  updatePreferences(userId: string, patch: PreferencePatch): Promise<ProfileRecord | null>;

  addUsage(userId: string, rows: UsageRow[]): Promise<void>;
  usageRange(userId: string, from: string, to: string): Promise<{ date: string; app: string; reels: number }[]>;

  /** You and your friends, with that day's total each. Ordering is the route's job. */
  board(userId: string, date: string): Promise<BoardMember[]>;

  setInvite(userId: string, code: string, expiresAt: Date): Promise<void>;
  inviterByCode(code: string): Promise<InviterRecord | null>;
  /** One transaction: locks both accounts, checks both caps, writes both directions. */
  acceptInvite(userId: string, inviterId: string): Promise<AcceptOutcome>;

  addFeedback(userId: string, topic: string, message: string): Promise<void>;

  progress(installId: string, userId: string | null): Promise<(OnboardingRow & { installId: string })[]>;
  writeProgress(installId: string, row: OnboardingRow): Promise<void>;

  setSubscription(userId: string, state: SubscriptionState): Promise<void>;
}
