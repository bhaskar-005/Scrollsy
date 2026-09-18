import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Env } from './env.ts';

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/**
 * One client, holding the only credential this Worker has for the database.
 *
 * There used to be three: a public one, an admin one, and one built per request
 * carrying the caller's token so Postgres could apply row level security. None
 * of that is in the path any more. The Worker verifies the caller itself and
 * passes their id into every call, so the database no longer decides who
 * anyone is, and nothing here needs per request state.
 *
 * Keyed on the env object, which a Worker isolate keeps for its lifetime.
 */
const shared = new WeakMap<Env, SupabaseClient>();

export function db(env: Env): SupabaseClient {
  let client = shared.get(env);
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, noSession);
    shared.set(env, client);
  }
  return client;
}
