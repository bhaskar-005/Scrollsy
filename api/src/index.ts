/**
 * The Doomless API, a Cloudflare Worker. The app talks to this and nothing
 * else, and knows only this Worker's address. The Supabase project's address and
 * keys are Worker secrets, never in the app.
 *
 * Every route is one indexed query or one database function call. Routes that
 * touch a person's data forward that person's own token, so Postgres verifies it
 * and the row level security in `supabase/migrations` applies exactly as
 * `supabase/tests` proves. There is no second permission layer here to drift out
 * of step with it.
 *
 * Everything sits under /v1. Installed copies of the app cannot be forced to
 * update, so a breaking change ships as /v2 alongside this, never in place.
 */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import type { AppEnv } from './env.ts';
import { auth } from './routes/auth.ts';
import { invites } from './routes/invites.ts';
import { leaderboard } from './routes/leaderboard.ts';
import { feedback, me } from './routes/me.ts';
import { onboarding } from './routes/onboarding.ts';
import { usage } from './routes/usage.ts';
import { webhooks } from './routes/webhooks.ts';

const v1 = new Hono<AppEnv>();

/** The largest real body is a month of pending usage, a few kilobytes. */
v1.use(
  bodyLimit({
    maxSize: 64 * 1024,
    onError: (c) => c.json({ error: 'payload_too_large' }, 413),
  }),
);

v1.route('/auth', auth);
v1.route('/me', me);
v1.route('/feedback', feedback);
v1.route('/usage', usage);
v1.route('/onboarding', onboarding);
v1.route('/leaderboard', leaderboard);
v1.route('/invites', invites);
v1.route('/webhooks', webhooks);

const app = new Hono<AppEnv>();

app.get('/', (c) => c.json({ status: 'ok', message: 'Server is up and active' }));
app.route('/v1', v1);

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((error, c) => {
  console.error('api', error);
  return c.json({ error: 'server_error' }, 500);
});

export default app;
