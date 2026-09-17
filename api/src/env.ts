/** What `limit()` needs from a Cloudflare Rate Limiting binding. Small, so tests can fake it. */
export type RateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

/** Everything the Worker is given. Declared in wrangler.jsonc. */
export type Env = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  /** A secret key, or a legacy service role key. Bypasses row level security. */
  SUPABASE_SECRET_KEY: string;
  REVENUECAT_WEBHOOK_AUTH: string;
  REVENUECAT_API_KEY: string;
  REVENUECAT_ENTITLEMENT_ID: string;
  USER_LIMIT: RateLimiter;
  /** Signed out routes: onboarding progress and invite previews. */
  PUBLIC_LIMIT: RateLimiter;
};

/** The signed in caller, set by `requireUser`. */
export type Caller = {
  /** The whole `Authorization` header, forwarded untouched to Supabase. */
  authorization: string;
  token: string;
  userId: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: { caller: Caller };
};
