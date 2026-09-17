/**
 * The shape of the API as the app sees it. Identical to the other backend's,
 * so the app works against either one without changing a line.
 */

export const DatePattern = /^\d{4}-\d{2}-\d{2}$/;
export const InviteCodePattern = /^[0-9a-f]{12}$/;
export const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** In order. Must match `onboarding_step_rank` in the migration. */
export const OnboardingSteps = [
  'welcome',
  'concept',
  'permission',
  'notifications',
  'friends',
  'paywall',
  'done',
] as const;

export type OnboardingStep = (typeof OnboardingSteps)[number];

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === 'string' && (OnboardingSteps as readonly string[]).includes(value);
}

export function onboardingRank(step: OnboardingStep): number {
  return OnboardingSteps.indexOf(step);
}

/** The widest history range one request may ask for. */
export const MaxHistoryDays = 92;

/** Days between two date keys, counting both ends. Zero or less when reversed. */
export function spanDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** `YYYY-MM-DD`, a number of days from another one. */
export function shiftDate(date: string, days: number): string {
  const moved = new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000);
  return moved.toISOString().slice(0, 10);
}

/**
 * An Auth failure as a status. Auth's own refusals mean the credential is bad
 * and the app should sign out. Anything else is an outage, and signing someone
 * out because Auth hiccuped would be worse than failing one request.
 */
export function authFailureStatus(status: number | undefined): 401 | 503 {
  return status !== undefined && status >= 400 && status < 500 ? 401 : 503;
}

export type SessionLike = { access_token: string; refresh_token: string; expires_at?: number };

export function toSession(session: SessionLike) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    /** Seconds since the epoch. */
    expiresAt: session.expires_at ?? 0,
  };
}

/** The raw token out of an `Authorization: Bearer ...` header, or null. */
export function tokenOf(header: string | undefined): string | null {
  return header?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
}
