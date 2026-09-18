/** What `limit()` needs from a Cloudflare Rate Limiting binding. Small, so tests can fake it. */
export type RateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

/** Everything the Worker is given. Declared in wrangler.jsonc. */
export type Env = {
  SUPABASE_URL: string;
  /** The only database credential. There is no second, weaker one any more. */
  SUPABASE_SECRET_KEY: string;
  /** Signs this Worker's own session tokens. Changing it ends every session. */
  JWT_SECRET: string;
  /** The Google Web client id, checked as the audience of every ID token. */
  GOOGLE_CLIENT_ID: string;
  REVENUECAT_WEBHOOK_AUTH: string;
  REVENUECAT_API_KEY: string;
  REVENUECAT_ENTITLEMENT_ID: string;
  USER_LIMIT: RateLimiter;
  /** Signed out routes: onboarding progress and invite previews. */
  PUBLIC_LIMIT: RateLimiter;
};

/** The signed in caller, set by `requireUser` once their token has verified. */
export type Caller = {
  token: string;
  userId: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: { caller: Caller };
};
