# Doomless build checklist

Built from `requirements.md`, `backend-plan.md` and `tracking-and-sync.md`,
walked screen by screen against the code as it stands. Where the build departed
from those plans, the reason is in
[What changed from the plan](#what-changed-from-the-plan).

`[x]` built and verified. `[ ]` still to do. Tags are the stages in `AGENTS.md`:
**S1** UI, **S2** local state and persistence, **S3** real tracking, **S4**
payments.

The pieces, and what each one is:

| Where | What it is | Checks |
| --- | --- | --- |
| `src/` | The Expo app | `npx tsc --noEmit`, `npm run lint`, `npm run test:sync` |
| `supabase/` | Database schema, and its tests | `npm run test:db` |
| `api/` | The API, a Cloudflare Worker | `npm --prefix api run check`, `npm run test:api` |
| `api-prisma/` | The same API on Prisma, a second Worker | `npm --prefix api-prisma run check`, `npm run test:api-prisma` |
| `web/` | The website and invite pages, Astro on Cloudflare | `npm --prefix web run check` |

Stage order note. `AGENTS.md` says finish each stage before the next. Stage 1 is
not finished (the cooked screen, the overlay counter and the limit step do not
exist). Backend work started anyway, at your direction. The Stage 1 gaps stay
listed below so they are not lost.

---

## Needs you before anything can go live

- [x] Migration applied to `tcmrgqsbueqflsjrqzrv`, through the IPv4 pooler in us-east-2, since the direct host has no IPv4 address. Was: Its direct Postgres host has no IPv4 address, so either paste `supabase/migrations/20260915000000_init.sql` into the SQL editor, or use `npx supabase link` and `npx supabase db push`
- [ ] A Cloudflare account. Then `npm --prefix api run deploy` and `npm --prefix web run deploy`
- [ ] The Supabase secret key, from Project Settings, API Keys, into `api/.dev.vars`. `SUPABASE_URL` is already filled in there. The publishable key is no longer used by anything: nothing but the Worker reaches the database
- [ ] Worker secrets for production, `cd api && npx wrangler secret put NAME` for each: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_API_KEY`. They must be Secrets, not plain Variables, or `wrangler deploy` refuses to run. `JWT_SECRET` is yours to invent, `openssl rand -hex 32`, and changing it later signs everyone out
- [x] The Worker's address is set in both `.env` and `web/wrangler.jsonc`. Was `EXPO_PUBLIC_API_URL` in `.env.local` and `API_URL` in `web/wrangler.jsonc`. `.env.local` and `api/.dev.vars` now exist with every line commented and explained, so filling them in is the whole job
- [ ] Google Cloud OAuth clients, one Web and one Android with the signing key's SHA-1. The Web client id goes in two places, both ours: `.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and the Worker secret `GOOGLE_CLIENT_ID`. Supabase Auth is not involved and its Google provider can stay switched off, since the Worker verifies Google's token itself
- [ ] RevenueCat project, Play products, an entitlement named `pro`, webhook pointed at `<worker>/v1/webhooks/revenuecat` with the Authorization value you set above
- [x] Real Terms and Privacy pages, served by `web/` at `/terms` and `/privacy`, with `src/constants/legal.ts` pointing at them through `EXPO_PUBLIC_SITE_URL`. The privacy page names the Accessibility Service and what it is for, which Play requires. Both are written from what the code actually does and still want a read by someone who knows the law where you are selling
- [x] Prices settled. Monthly $5 (₹199), yearly $19.99 (₹499), and $1 (₹1) for the first 14 days on yearly only. See docs/payments-setup.md
- [ ] Check Play allows a one rupee introductory price in India. Play sets a minimum price per country and it may be above that
- [ ] A domain for the website, if the `workers.dev` address should not be the invite link. It goes in `.env.local` as `EXPO_PUBLIC_SITE_URL`, which is what the share sheet hands out
- [ ] The app's signing key SHA-256 fingerprints in `web/wrangler.jsonc`, plus the matching `intentFilters` in `app.json`, to make invite links open the app directly
- [ ] Decide what period the leaderboard ranks. Built as today
- [x] Accessibility Service justification written, on the privacy page. The service is scoped to five packages and one event type, with `canRetrieveWindowContent="false"`, so the claim that it cannot read the screen is enforced by its own config rather than promised
- [ ] A development build, `npx expo run:android` or EAS. Google sign in is native, so Expo Go cannot do it. The app itself still runs in Expo Go, the sign in button just reports that it is unavailable

---

## Onboarding, reviewed screen by screen

Every step is now recorded, on the device first and then on the server, so a
person resumes where they stopped and the funnel shows where people leave.
`select * from public.onboarding_funnel;` in the Supabase SQL editor reads how
many installs reached each step and how many stopped there.

### Launch, `src/app/index.tsx`

- [x] Every launch used to replay onboarding. It now opens at the furthest step this install reached, or Home once finished **S2**
- [x] Progress is recorded per install, so someone who quits on the welcome screen still appears in the funnel **S2**
- [x] A signed in person on a new phone picks up where their account left off, `pullOnboardingProgress` **S2**

### 01 Welcome

- [x] Records the step, even signed out **S2**
- [x] "Log in with Google" signs in. `@react-native-google-signin/google-signin` is installed and wired through `src/lib/google.ts`, which loads the native half on the first tap so the rest of the app still runs without it. Needs a development build and the OAuth clients above to actually complete **S2**
- [x] Replay onboarding from Settings no longer asks a signed in person to log in again. The button moves straight on **S2**
- [ ] What happens to someone who declines Google, `requirements.md` open question 7

### 02 Concept

- [x] Reviewed, and records the step. Nothing else to persist
- [ ] No Skip here, though `requirements.md` asks for Skip on steps 2 to 7. The single button already moves on, so this may be right. Confirm

### 03 Permission

- [x] Records the step **S2**
- [ ] "Allow" only ticks the row. No Android settings page opens **S3**
- [ ] "Continue" works with nothing granted, and there is no denied state. Without screen time nothing is counted, so that person reaches Home with a count stuck at zero and no explanation **S1**
- [x] What was granted is saved and read back, so the rows show what is already on **S2**

### 04 Notifications

- [x] Records the step **S2**
- [ ] "Turn on notifications" asks for nothing. These alerts are about the person's own count, which the device knows before any server does, so they are local notifications (`expo-notifications`) fired on device when a stage is crossed. No push tokens, no server, and they work offline **S3**
- [x] The choice is saved either way, and Settings opens showing it **S2**
- [ ] Skip jumps past Friends to the paywall, while both buttons go to Friends. Confirm that is intended

### 05 Friends

- [x] Records the step **S2**
- [x] "Challenge a friend" makes a real invite and opens the share sheet, then moves on either way **S2**
- [x] A link opening the app is handled, `src/app/invite/[code].tsx`. The code waits on the device until there is an account, then is accepted **S2**
- [ ] Nothing tells a person when accepting failed because their friend list is full. That needs a screen, and it is where the plan sells itself **S1**

### 06 Paywall

- [x] Records the step, and finishing marks onboarding complete **S2**
- [x] Copy matches the real offer. It said "Start 7 days free" while the app sold a one rupee entry. It now says "Start for ₹1", one dollar outside India
- [x] The renewal terms are back on this screen, and now read from the offer the store returned, so they cannot drift from what is charged **S1**
- [x] The plan picker is back too, since RevenueCat drives it now **S1**
- [x] Buying works, `src/lib/purchases.ts`. `Purchases.logIn(userId)` runs with the Supabase account id, which is what lets the webhook find the row **S4**
- [x] Prices come from the store, already formatted in the buyer's own currency. The written ones in `Pricing` show only until the store answers, and if it never does **S4**
- [ ] The daily limit step, `requirements.md` step 04, is not built **S1**

---

## Home

- [x] The count reads from the device's own store, instantly and offline
- [x] The mascot's stage is worked out from the count, never stored. The placeholder had shown Dizzy at 338 reels, breaking the hundred per stage rule. It now correctly shows Fried
- [x] The Lock reels row reads the real `premium`, cached on the device so a cold start never flashes the free state **S2**
- [x] Header name and photo from the account **S2**
- [ ] The cooked screen at the daily limit, `requirements.md` screen 09 **S1**

## Stats

- [x] Chart, tiles, weekly total and the per app card all read the local store, through `useUsageWeek` **S2**
- [x] A device with no history of its own folds the server's in, `pullUsage` in `src/lib/sync.ts`. The larger of the two totals wins, so nothing counted here is lost and nothing already on the server uploads twice **S2**
- [ ] History past 7 days for Pro. The server already refuses it to free accounts **S4**
- [ ] The week arrows do nothing

## Settings

- [x] Account block from the account, name, photo and email. The email rides in the access token rather than costing a second request **S2**
- [x] Counter style, daily limit and notifications are written on the device first and sent after. A change made offline waits in `profile.unsent` and goes out with the next sync pass **S2**
- [x] The counter sheet is the style picker, each option wearing today's real count. The handset you dragged the counter around is gone, at your call: where it sits is better chosen by dragging the real overlay once that exists, and the columns are still there for it **S1**
- [x] Signed out shows one thing, the way back in, rather than an empty account card **S2**
- [x] Dark mode is stored on the device and repaints the app. Until someone picks, it follows the phone **S2**
- [x] "Send feedback" sends, and says so when it could not **S2**
- [x] "Log out" pushes what is still owed, then takes the account, its counts and the Google account off the phone **S2**
- [x] Delete account, with a confirmation that says plainly a Play subscription is cancelled in Play, not here **S1**
- [x] The daily limit opens a picker for members, and the paywall for everyone else **S2**
- [ ] The Screen time row's value is fixed text **S3**

## Battle

- [x] The board is fetched every time the tab comes into view **S2**
- [x] The last board is kept on the device, for today only, so opening it offline shows something rather than nothing **S2**
- [x] Your own row is raised to this device's count when the server has not caught up, so the number never drops between tabs **S2**
- [x] Empty seats make a real invite and open the share sheet **S2**
- [x] Signed out, the tab asks you to log in rather than showing an empty board **S2**
- [x] The five friend cap is enforced by the database, not the screen, and tested

---

## Backend, built and verified

### Database, `supabase/`

- [x] One account table, `profiles`, plus `daily_usage`, `friendships`, `feedback` and `onboarding_progress`
- [x] Row level security on every table, Supabase's default grants revoked, and writes only through the paths the migration opens
- [x] `premium` is a generated column, so neither a person nor a bug can set it apart from the subscription
- [x] `onboarding_funnel`, a view for the team, not reachable from the app
- [x] `npm run test:db`, 74 checks run as real signed in users against Postgres (PGlite). Deliberately breaking two rules in a copy of the migration made the matching checks fail, so they are not passing by accident

### API, `api/`, a Cloudflare Worker

- [x] One Worker, routed with Hono, everything under `/v1`. Auth, profile, usage, leaderboard, invites, feedback, onboarding progress, and the RevenueCat webhook
- [x] The Supabase address and keys are Worker secrets. The app holds neither
- [x] Each person's own token is forwarded to Postgres, so row level security stays the one place permissions live
- [x] Rate limited per caller and per install, keyed on a hash of the token rather than the user id inside it, which anyone could forge
- [x] Smart Placement, so the Worker runs near the database it calls on every request
- [x] `npm run test:api`, 41 tests, including what each route sends over the wire. `wrangler deploy --dry-run` bundles clean at 165 KB gzipped

### The second API, `api-prisma/`, Prisma on Cloudflare

Built alongside the first, not instead of it. Same routes, same responses, so
the app points at whichever you deploy. Pick one before launch: two backends on
one database means two sets of rules to keep in step. See its README.

- [x] Prisma 7 with the client query compiler, so there is no Rust engine and it runs on Workers
- [x] `prisma/schema.prisma` describes the database `supabase/migrations` owns, rather than owning it
- [x] Tokens verified in the Worker with `jose`, since Postgres no longer checks them
- [x] Every rule that was row level security, a grant or a check constraint rebuilt in `src/rules.ts`
- [x] Connections through Hyperdrive, with Supabase's pooler as the fallback
- [x] `npm run test:api-prisma`, 35 tests, signing real tokens rather than stubbing the check
- [x] Bundles at 1.31 MB gzipped, against 151 KB for `api/`
- [x] Decided: `api/` ships. `api-prisma/` stays as a working alternative, not deployed. Two backends on one database would mean two sets of rules to keep in step
- [x] `api/` no longer uses Supabase Auth at all. Its own `users` table, Google ID tokens verified in the Worker with `jose`, and its own signed access tokens with rotating refresh tokens. Row level security is gone with it: the Worker names the caller in every call. No MAU limit, and the schema is plain Postgres that would run anywhere

### Website, `web/`, Astro on Cloudflare

- [x] `/invite/<code>`, server rendered, so a link preview in a chat shows who invited you
- [x] One button that does the right thing on Android: opens the app when installed, otherwise Play, carrying the invite code as the install referrer
- [x] Honest on other devices, where it offers the app rather than promising to open it
- [x] Three states, each checked by rendering it: a live invite, an expired one (404), and the API being unreachable (503, never cached)
- [x] Reaches the API Worker to Worker through a service binding, never over the public internet
- [x] `/.well-known/assetlinks.json`, driven by config, ready for App Links
- [x] A landing page to build on
- [ ] Read the install referrer after a fresh install, so an invite survives installing the app rather than needing the link tapped again **S2**

---

## Payments

- [x] `react-native-purchases`, loaded on first use so the rest of the app still runs without the native half
- [x] One file knows RevenueCat exists, `src/lib/purchases.ts`. Everything else asks `usePremium()`
- [x] Being a member is read from two places. The database is the durable answer, written by the webhook and read by a new phone. What the store told this device is the fast one, so the app changes the instant a purchase goes through rather than a webhook later. Either is enough
- [x] Buying, restoring, and signing out of the purchase identity so the next person on the phone inherits nothing
- [x] A purchase made before signing in is not lost. RevenueCat transfers it on `logIn`, and the webhook ignores anonymous ids until then, which `affectedUsers` already did
- [x] Prices, and the terms line, come from the store in the buyer's own currency. Four terms strings, monthly and yearly, with an introductory phase and without, because a sentence assembled from fragments cannot be translated
- [ ] Products in Play Console, an entitlement named `pro` in RevenueCat, and the public SDK key in `.env.local` **S4**
- [ ] Confirm RevenueCat's transfer behaviour for an anonymous purchase is "transfer to new App User ID", or a person who buys before signing in keeps the plan on the wrong identity **S4**
- [ ] Test purchases through a Play internal testing track. Nothing here has met a real store yet **S4**

---

## Device: counting and sync

- [x] Local store, `src/lib/usage-store.ts`. Its SQL was run against real SQLite, including a reel counted mid sync. That found a real bug, now fixed: marking a sync twice pushed the synced count past the total, and every reel after it would never have uploaded
- [x] Sync worker, `src/lib/sync.ts`. On launch, every minute while open, and on leaving or returning. Never two passes at once, and nothing is lost when a request fails, because nothing is taken out of the totals until the server confirms it
- [x] One pass carries everything owed: counted reels, changed settings, and how far onboarding got
- [x] Weeks offline are sent in whole days, at most 31 to a call. `increment_usage` refuses a longer array outright rather than taking what fits, so an oversized payload would have failed forever. `npm run test:sync`, 7 checks on `src/lib/sync-plan.ts`, and raising the limit past 31 makes the matching one fail
- [x] Signing in hands over everything counted and changed before there was an account to attach it to
- [x] A read of the account that crossed a write in flight is dropped rather than written over the newer state
- [x] Development seed, marked as already synced so it can never upload
- [ ] The Android counting service, Kotlin plus a config plugin, writing straight into `usage.db` **S3**
- [ ] Sync while the app is closed (`expo-background-task`), so friends see today's count without the person opening the app **S3**
- [ ] Tune "one reel" per app, and plan for retuning when those apps change **S3**
- [ ] Delete `placeholder.ts` and `dev-seed.ts` once counting is real **S2**

---

## What changed from the plan

Found while building. Each made the system smaller, safer, or both.

1. **One account table.** Your call. Subscription and invite state are columns on `profiles`. The two usage tables became one, and a day's total is the sum of its app rows, so the two can never disagree.
2. **Nobody can make themselves Pro.** The plan let a person update their own profile row, which included `premium`. Updates are now limited to named columns, and `premium` is generated from the subscription. Both are tested.
3. **The app talks to our API, not to Supabase.** Your call. Prisma was considered and not used: it needs a Node server this setup does not have, and it cannot express the row level security and grants the backend's safety rests on.
4. **The API is a Cloudflare Worker, not a Supabase Edge Function.** Your call. It carries the RevenueCat webhook too, so there is one thing to deploy. Supabase is the database and Auth only.
5. **Everything is under `/v1`.** Installed copies of an app cannot be forced to update, so a breaking change has to ship beside the old one rather than replace it.
6. **Onboarding progress is its own table, keyed by install.** Keyed by account instead, everyone who quit before signing in would be invisible, and that is the drop off most worth seeing.
7. **Invite links use the invite code, not the user id.** A user id in a link is permanent and cannot be revoked. Codes expire, rotate, and reveal only a name and photo.
8. **The webhook re-reads RevenueCat rather than trusting each event.** RevenueCat's own advice. Late, repeated and out of order events all end in the same state.
9. **No `friend_profiles` view.** Postgres cannot put row level security on a view. `leaderboard_for_me` returns only what a friend may see instead.
10. **Invite codes are reusable until they expire.** The "Invite the group chat" seat would break with single use codes.
11. **No pending friend state.** Opening someone's link is the consent.
12. **No push tokens and no push function.** Stage alerts are about your own count, which the device knows first. Local notifications do it with no server.
13. **No Realtime on Battle.** Row level security would stop friends' changes reaching you anyway, and counts arrive in batches minutes apart. The board refetches when opened.
14. **No `weekly_stats` function.** One range read does the same job.
15. **No streak column or nightly job.** No screen shows a streak since Home was simplified.
16. **No extra indexes on usage.** The primary keys already serve every range read, and each extra index is more work on every write.
17. **No NetInfo.** The sync timer retries within a minute.
18. **The native counter writes the SQLite file directly.** The plan drew an in-memory counter handed to JavaScript. JavaScript is not running while someone scrolls another app, so that design would have lost counts.
19. **Feedback is a direct insert, no function.** Row level security covers it.
20. **The entry price follows the phone's currency, for now.** One rupee in India, one dollar elsewhere. It has to come from the store's own localized price before launch, because the price shown must be the price charged.
