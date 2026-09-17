/**
 * The Doomless API, Prisma edition. Same routes and same responses as the
 * Worker in `api/`, so the app works against either without a change.
 *
 * How it differs, and what that costs:
 *
 * The other backend hands each caller's token to Postgres, so row level
 * security decides what that person can see, and `supabase/tests` proves it in
 * SQL. Prisma connects as one privileged user, so none of that applies here.
 * Every rule moved into TypeScript: `src/auth.ts` verifies tokens, `src/rules.ts`
 * holds what the policies and constraints used to say, and `test/` checks them.
 * A mistake in either is not caught by the database, it is simply open.
 *
 * Connections go through Hyperdrive, since a Worker can open far more of them
 * than Postgres will accept.
 *
 * Everything sits under /v1, so a breaking change ships beside this rather than
 * replacing it, because installed copies of an app cannot be forced to update.
 */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { connect } from './db.ts';
import type { AppEnv } from './env.ts';
import { withStore, type StoreFactory } from './http.ts';
import { prismaStore } from './prisma-store.ts';
import { auth, feedback, me } from './routes/account.ts';
import { onboarding } from './routes/onboarding.ts';
import { invites, leaderboard } from './routes/social.ts';
import { usage } from './routes/usage.ts';
import { webhooks } from './routes/webhooks.ts';

/** A Prisma client per request, closed once the response is out. */
const prismaFactory: StoreFactory = (env) => {
  const db = connect(env);
  return { store: prismaStore(db), dispose: () => db.$disconnect() };
};

/** The factory is an argument so tests can run every route against a fake database. */
export function createApp(factory: StoreFactory = prismaFactory) {
  const app = new Hono<AppEnv>().basePath('/v1');

  /** The largest real body is a month of pending usage, a few kilobytes. */
  app.use(bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: 'payload_too_large' }, 413) }));
  app.use(withStore(factory));

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

  return app;
}

export default createApp();
