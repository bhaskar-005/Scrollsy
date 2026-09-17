import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Env } from './env.ts';

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/**
 * The two clients that carry no user hold no per request state, so each is
 * built once per isolate and reused by every request it serves. Keyed on the
 * env object, which a Worker isolate keeps for its lifetime.
 */
const shared = new WeakMap<Env, { public: SupabaseClient; admin: SupabaseClient }>();

function sharedClients(env: Env) {
  let clients = shared.get(env);
  if (!clients) {
    clients = {
      public: createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, noSession),
      admin: createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, noSession),
    };
    shared.set(env, clients);
  }
  return clients;
}

/** No user. Signing in, refreshing, and onboarding before there is an account. */
export function publicClient(env: Env) {
  return sharedClients(env).public;
}

/** Bypasses row level security. Only for what no user can be trusted to do. */
export function adminClient(env: Env) {
  return sharedClients(env).admin;
}

/**
 * Acts as the caller. Their token goes to Postgres untouched, so the database
 * verifies it and every row level security rule and `auth.uid()` check in the
 * migration applies exactly as its tests prove. Nothing here re-verifies it,
 * which saves a round trip to Auth on every request.
 *
 * Built per request, because it carries that one person's token.
 */
export function userClient(env: Env, authorization: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    ...noSession,
    global: { headers: { Authorization: authorization } },
  });
}
