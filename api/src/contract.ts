/**
 * The shape of the API as the app sees it: stable camelCase fields and one
 * error code per failure, whatever Supabase returns underneath. Pure, so it is
 * tested on its own, see contract_test.ts.
 */

/** Errors the database raises on purpose, and the status each one means. */
const DatabaseCodes: Record<string, number> = {
  not_authenticated: 401,
  invite_invalid: 404,
  invite_own: 400,
  friend_cap_self: 409,
  friend_cap_inviter: 409,
  usage_payload_invalid: 400,
  leaderboard_date_out_of_range: 400,
  onboarding_step_invalid: 400,
};

export type DatabaseError = { message?: string; code?: string };

export type Failure = { status: number; code: string };

/** A supabase-js error, as the status and single code the app receives. */
export function toFailure(error: DatabaseError): Failure {
  const message = error.message ?? '';

  // Own keys only. `in` would also match inherited names like `constructor`.
  const known = Object.hasOwn(DatabaseCodes, message) ? DatabaseCodes[message] : undefined;
  if (known !== undefined) {
    return { status: known, code: message };
  }
  // PostgREST's own token errors: missing, malformed, or expired.
  if (error.code?.startsWith('PGRST30')) {
    return { status: 401, code: 'not_authenticated' };
  }
  // A check constraint, or a value Postgres could not parse.
  if (error.code === '23514' || error.code === '22P02' || error.code === '22007') {
    return { status: 400, code: 'invalid_value' };
  }
  return { status: 500, code: 'server_error' };
}

/**
 * An Auth failure as a status. Auth's own refusals mean the credential is bad
 * and the app should sign out. Anything else is an outage, and signing someone
 * out because Auth hiccuped would be worse than failing this one request.
 */
export function authFailureStatus(status: number | undefined): 401 | 503 {
  return status !== undefined && status >= 400 && status < 500 ? 401 : 503;
}

export const DatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const InviteCodePattern = /^[0-9a-f]{12}$/;

export const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The onboarding flow in order. Must match `onboarding_step_rank` in the migration. */
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

/**
 * The widest history range one request may ask for. Three apps a day keeps
 * 92 days under PostgREST's 1000 row cap with room to spare, so a response is
 * never silently cut short.
 */
export const MaxHistoryDays = 92;

/** Days between two date keys, counting both ends. Zero or less when reversed. */
export function spanDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** The preference fields the app may change, and the column each one writes. */
const PreferenceColumns = {
  dailyLimit: 'daily_limit',
  counterStyle: 'counter_style',
  counterPositionX: 'counter_position_x',
  counterPositionY: 'counter_position_y',
  notificationsEnabled: 'notifications_enabled',
  screenTimeGranted: 'screen_time_granted',
  overlayGranted: 'overlay_granted',
} as const;

/**
 * The columns to update, from a request body. Null when the body is not an
 * object, is empty, or names any field outside the list above, so a typo fails
 * loudly instead of being quietly dropped. Value ranges are left to the
 * database's check constraints, which already hold them.
 */
export function toPreferencePatch(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const patch: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(body)) {
    const column = PreferenceColumns[field as keyof typeof PreferenceColumns];
    if (!column) {
      return null;
    }
    patch[column] = value;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

/** Exactly the columns `GET /me` reads. Never `select *`. */
export const ProfileColumns =
  'id, display_name, avatar_url, daily_limit, counter_style, counter_position_x, counter_position_y, ' +
  'notifications_enabled, screen_time_granted, overlay_granted, ' +
  'premium, subscription_status, subscription_expires_at';

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  daily_limit: number;
  counter_style: string;
  counter_position_x: number;
  counter_position_y: number;
  notifications_enabled: boolean;
  screen_time_granted: boolean;
  overlay_granted: boolean;
  premium: boolean;
  subscription_status: string;
  subscription_expires_at: string | null;
};

export function toProfile(row: ProfileRow, email: string | null = null) {
  return {
    id: row.id,
    name: row.display_name,
    email,
    avatarUrl: row.avatar_url,
    dailyLimit: row.daily_limit,
    counterStyle: row.counter_style,
    counterPosition: { x: row.counter_position_x, y: row.counter_position_y },
    notificationsEnabled: row.notifications_enabled,
    screenTimeGranted: row.screen_time_granted,
    overlayGranted: row.overlay_granted,
    premium: row.premium,
    subscription: { status: row.subscription_status, expiresAt: row.subscription_expires_at },
  };
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

/** A token's payload, read without verifying it. See `subjectOf`. */
function claimsOf(token: string): Record<string, unknown> | null {
  const payload = token.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const claims: unknown = JSON.parse(atob(padded));
    return claims !== null && typeof claims === 'object' ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The user id inside a token, read without verifying it. Only ever used as a
 * filter on a request that forwards the same token, which Postgres does verify,
 * so a forged token gets nothing. Reading it here saves a round trip to Auth.
 */
export function subjectOf(token: string): string | null {
  const sub = claimsOf(token)?.sub;
  return typeof sub === 'string' ? sub : null;
}

/**
 * The email inside a token. Auth owns it, not `profiles`, so the alternative
 * would be a second request to Auth on every profile read.
 *
 * Unverified here, like the id above, and only ever answered alongside a row
 * Postgres agreed to hand over for this same token. A forged token gets a 401
 * from the database before this is reached.
 */
export function emailOf(token: string): string | null {
  const email = claimsOf(token)?.email;
  return typeof email === 'string' ? email : null;
}
