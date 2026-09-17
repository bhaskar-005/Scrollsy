# Doomless API, Prisma edition

The same API as `api/`, same routes, same responses, built on Prisma instead of
Supabase's own client. The app works against either without a change: point
`EXPO_PUBLIC_API_URL` at whichever is deployed.

Pick one to run in production. Running both against the same database works,
but then two sets of rules have to stay in step.

## What is different, and what it costs

`api/` hands each caller's token to Postgres. Row level security decides what
that person can read and write, and `supabase/tests` proves it, in SQL, as real
signed in users.

Prisma connects as one privileged database user. Row level security is not in
the path at all, which means:

- **Tokens are verified here**, in `src/auth.ts`. Nothing downstream checks
  them. If that file is wrong, every route is open.
- **The rules moved into TypeScript**, in `src/rules.ts`: who may read history,
  what a preference patch may name, what a sync may write, the friend cap.
  These were policies, grants and check constraints. `test/rules.test.ts` is
  now the only thing proving them.
- **A bug fails open.** In `api/`, a route that forgot a check still could not
  read someone else's row, because the database refused. Here it can.

What you get for that: one query language across the schema, generated types
from the schema itself, and no PostgREST in the path.

Two smaller costs, measured rather than guessed:

- The bundle is 1.3 MB gzipped against 151 KB, because Prisma ships a WebAssembly
  query compiler. Both deploy fine. The larger one starts more slowly when cold.
- The leaderboard takes two queries instead of one. Prisma cannot express the
  per person sum that `leaderboard_for_me` did in a single statement.

## Connections

A Worker can open far more connections than Postgres accepts, so put a pool in
front of it. Hyperdrive is the binding in `wrangler.jsonc`:

```
npx wrangler hyperdrive create doomless --connection-string "postgresql://..."
```

Put the id it prints into `wrangler.jsonc`. Without it the Worker falls back to
`DATABASE_URL`, which should be Supabase's pooler on port 6543, never the direct
connection on 5432.

## The schema

`supabase/migrations` still owns the database. `prisma/schema.prisma` only
describes it, so that Prisma can type queries against it.

**Never run `prisma migrate` against this database.** It does not know about the
row level security, the grants, the triggers or the generated `premium` column,
and it would drop them. When the migration changes, update the schema file to
match, or run `prisma db pull`.

## Commands

```
npm install
npm run generate     # after any schema change
npm test             # rules and routes, no database needed
npm run check        # generate, type check, and a dry run deploy
npm run dev
npm run deploy
```

Secrets, set with `npx wrangler secret put NAME`: `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`,
`REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_API_KEY`. Add `SUPABASE_JWT_SECRET` only
for a project still on legacy symmetric keys.
