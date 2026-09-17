import type { Store } from './store.ts';

/** What `limit()` needs from a Cloudflare Rate Limiting binding. Small, so tests can fake it. */
export type RateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type Env = {
  /** Auth still lives in Supabase. Only the data layer moved to Prisma. */
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  /** Only for a project still using legacy symmetric JWTs. */
  SUPABASE_JWT_SECRET?: string;

  /** Used when there is no Hyperdrive binding. Point it at Supabase's pooler. */
  DATABASE_URL?: string;
  HYPERDRIVE?: { connectionString: string };

  REVENUECAT_WEBHOOK_AUTH: string;
  REVENUECAT_API_KEY: string;
  REVENUECAT_ENTITLEMENT_ID: string;

  USER_LIMIT: RateLimiter;
  PUBLIC_LIMIT: RateLimiter;
};

/** The signed in caller. Their token is verified here, not by Postgres. */
export type Caller = { userId: string; email: string | null; token: string };

export type AppEnv = {
  Bindings: Env;
  Variables: { caller: Caller; store: Store };
};
