/**
 * Every rule that used to live in the database.
 *
 * In the other backend these were SQL: row level security decided who could
 * read a row, a check constraint decided what a column could hold, and
 * `increment_usage` decided what a sync was allowed to write. Prisma connects
 * as one privileged user, so none of that is in the path any more. This file is
 * where those rules moved, and it is pure, so every one of them is tested.
 */
import { DatePattern, OnboardingSteps, onboardingRank, shiftDate, type OnboardingStep } from './contract.ts';

/** The apps the schema knows. Anything else is dropped rather than stored. */
export const KnownApps = ['instagram', 'tiktok', 'youtube'] as const;
export type AppKey = (typeof KnownApps)[number];

export const CounterStyles = ['pill', 'outline', 'glass', 'plain', 'mascot'] as const;

/** Was a check constraint on daily_usage, and a clamp inside increment_usage. */
export const MaxReelsPerSync = 5000;
/** Was the window `increment_usage` accepted days within. */
export const MaxSyncAgeDays = 30;
/** Was the row level security policy on daily_usage. */
export const FreeHistoryDays = 7;
/** Was `friend_cap_reached`. */
export const FreeFriendCap = 5;
/** Was the reuse window inside `create_invite`. */
export const InviteLifetimeDays = 7;
export const InviteRenewWithinDays = 1;

export type UsageRow = { date: string; app: AppKey; reels: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * What a sync is allowed to write, from what the device sent.
 *
 * Anything unusable is dropped rather than refused: a day past the window, a
 * date from a wrong clock, an app this schema does not know. Refusing would
 * fail the whole batch, the device would retry it forever, and one bad day
 * would block every good one behind it.
 */
export function toUsageRows(days: unknown, today: string): UsageRow[] {
  if (!Array.isArray(days) || days.length > 31) {
    return [];
  }

  const earliest = shiftDate(today, -MaxSyncAgeDays);
  const latest = shiftDate(today, 1);
  const rows: UsageRow[] = [];

  for (const day of days) {
    if (!isRecord(day) || typeof day.date !== 'string' || !DatePattern.test(day.date)) {
      continue;
    }
    if (day.date < earliest || day.date > latest || !isRecord(day.apps)) {
      continue;
    }

    for (const [app, reels] of Object.entries(day.apps)) {
      if (!(KnownApps as readonly string[]).includes(app)) {
        continue;
      }
      if (typeof reels !== 'number' || !Number.isFinite(reels) || reels <= 0) {
        continue;
      }
      rows.push({
        date: day.date,
        app: app as AppKey,
        reels: Math.min(Math.round(reels), MaxReelsPerSync),
      });
    }
  }

  return rows;
}

/** Was the `usage_date >= current_date - 6 or is_premium()` half of the policy. */
export function historyAllowed(from: string, premium: boolean, today: string): boolean {
  return premium || from >= shiftDate(today, -(FreeHistoryDays - 1));
}

/** Was the column level grant: these fields, and only these, may be written by their owner. */
const PreferenceFields = {
  dailyLimit: (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10_000,
  counterStyle: (value: unknown) => typeof value === 'string' && (CounterStyles as readonly string[]).includes(value),
  counterPositionX: (value: unknown) => typeof value === 'number' && value >= 0 && value <= 1,
  counterPositionY: (value: unknown) => typeof value === 'number' && value >= 0 && value <= 1,
  notificationsEnabled: (value: unknown) => typeof value === 'boolean',
  screenTimeGranted: (value: unknown) => typeof value === 'boolean',
  overlayGranted: (value: unknown) => typeof value === 'boolean',
} as const;

export type PreferencePatch = Partial<{
  dailyLimit: number;
  counterStyle: string;
  counterPositionX: number;
  counterPositionY: number;
  notificationsEnabled: boolean;
  screenTimeGranted: boolean;
  overlayGranted: boolean;
}>;

/**
 * The fields to write, from a request body. Null when the body names anything
 * else, or holds a value the old check constraints would have refused, so a
 * typo fails loudly rather than being quietly dropped.
 */
export function toPreferencePatch(body: unknown): PreferencePatch | null {
  if (!isRecord(body)) {
    return null;
  }

  const patch: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(body)) {
    const accepts = PreferenceFields[field as keyof typeof PreferenceFields];
    if (!accepts || !accepts(value)) {
      return null;
    }
    patch[field] = value;
  }

  return Object.keys(patch).length > 0 ? (patch as PreferencePatch) : null;
}

/** Twelve hex characters, as `create_invite` made them. */
export function newInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function inviteIsLive(expiresAt: Date | null, now: Date): boolean {
  return expiresAt !== null && expiresAt.getTime() > now.getTime();
}

/** Was `create_invite`: keep a code with real time left, mint one otherwise. */
export function needsFreshInvite(expiresAt: Date | null, now: Date): boolean {
  return expiresAt === null || expiresAt.getTime() <= now.getTime() + InviteRenewWithinDays * 86_400_000;
}

export function inviteExpiry(now: Date): Date {
  return new Date(now.getTime() + InviteLifetimeDays * 86_400_000);
}

/** Was `friend_cap_reached`. */
export function friendCapReached(premium: boolean, friendCount: number): boolean {
  return !premium && friendCount >= FreeFriendCap;
}

export type OnboardingRow = {
  userId: string | null;
  currentStep: string;
  furthestStep: string;
  reachedAt: Record<string, string>;
  completedAt: Date | null;
};

/** Was the `where` on `record_onboarding_step`'s upsert: an install that belongs to someone is theirs. */
export function mayWriteProgress(existing: OnboardingRow | null, userId: string | null): boolean {
  return existing === null || existing.userId === null || existing.userId === userId;
}

/**
 * Was the rest of that upsert. The furthest step only moves forward, the first
 * time a step was reached is never overwritten, and completion is stamped once.
 */
export function mergeProgress(
  existing: OnboardingRow | null,
  step: OnboardingStep,
  userId: string | null,
  now: Date,
): OnboardingRow {
  const furthestBefore = existing && (OnboardingSteps as readonly string[]).includes(existing.furthestStep)
    ? (existing.furthestStep as OnboardingStep)
    : null;

  return {
    userId: existing?.userId ?? userId,
    currentStep: step,
    furthestStep:
      furthestBefore && onboardingRank(furthestBefore) >= onboardingRank(step) ? furthestBefore : step,
    reachedAt: { [step]: now.toISOString(), ...(existing?.reachedAt ?? {}) },
    completedAt: existing?.completedAt ?? (step === 'done' ? now : null),
  };
}

/** Was `onboarding_resume`: the furthest across this install and this account. */
export function furthestOf(rows: OnboardingRow[]): { step: OnboardingStep; completed: boolean } | null {
  const steps = rows
    .map((row) => row.furthestStep)
    .filter((step): step is OnboardingStep => (OnboardingSteps as readonly string[]).includes(step));

  if (steps.length === 0) {
    return null;
  }

  return {
    step: steps.reduce((furthest, step) => (onboardingRank(step) > onboardingRank(furthest) ? step : furthest)),
    completed: rows.some((row) => row.completedAt !== null),
  };
}
