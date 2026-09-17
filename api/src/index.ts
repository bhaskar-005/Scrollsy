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

const app = new Hono<AppEnv>().basePath('/v1');

/** The largest real body is a month of pending usage, a few kilobytes. */
app.use(
  bodyLimit({
    maxSize: 64 * 1024,
    onError: (c) => c.json({ error: 'payload_too_large' }, 413),
  }),
);

app.route('/auth', auth);
app.route('/me', me);
app.route('/feedback', feedback);
app.route('/usage', usage);
app.route('/onboarding', onboarding);
app.route('/leaderboard', leaderboard);
app.route('/invites', invites);
app.route('/webhooks', webhooks);

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((error, c) => {
  console.error('api', error);
  return c.json({ error: 'server_error' }, 500);
});

export default app;
