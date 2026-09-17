# Doomless tracking and sync plan

> **Superseded in parts by the build.** Two corrections matter most. The native
> counter writes straight into the SQLite file rather than handing counts to
> JavaScript, which is not running while someone scrolls another app. And the
> local store is one table, not two. The source of truth is
> `src/lib/usage-store.ts` and `src/lib/sync.ts`, with every difference listed in
> [`docs/checklist.md`](checklist.md#what-changed-from-the-plan).

How a reel scrolled on the device becomes a number in the database. Companion
to `docs/requirements.md` (the UI spec) and `docs/backend-plan.md` (the
Supabase schema). Those two documents assume a number arrives. This one is
what happens before it does: counting it on device, storing it locally first,
and pushing it to the server only when there is a connection to push it over.

The rule this whole document follows: **the device is the source of truth for
its own screen, the server is the source of truth for everyone else's.** Home
never waits on a network call to show your own count. Battle always does,
because it is showing you other people's counts. Every section below is that
one rule applied to a specific screen or a specific piece of machinery.

---

## The pipeline, end to end

```
target app in foreground (Instagram, TikTok, YouTube)
        │
        ▼
AccessibilityService (native, Kotlin)      one per scroll event, heuristic
        │  debounced, batched every ~3-5s
        ▼
in-memory counter, per app key
        │  flushed on a timer and on backgrounding
        ▼
local SQLite  (local_daily_usage, local_app_usage)   ◄── every screen reads from here
        │  sync worker reads the unsynced delta
        ▼
increment_usage RPC (Supabase, additive, see backend-plan.md)
        │
        ▼
Postgres  daily_usage, daily_app_usage                source of truth for everyone else
        │  Realtime, friends only
        ▼
Battle screen on a friend's device
```

Nothing above the local SQLite line needs a network connection. Nothing below
it is trustworthy without one. That is the whole architecture.

---

## Counting: how a reel becomes a number

Android has no API that returns "reels shown." `UsageStatsManager`, the
permission already asked for on the permission screen, gives foreground time
per app, not a count of anything inside it. Getting an actual count needs an
`AccessibilityService`, watching a fixed set of target packages
(`com.instagram.android`, `com.zhiliaoapp.musically`, `com.google.android.youtube`,
matching the `instagram` / `tiktok` / `youtube` keys `AppUsageEntry` already
uses in `placeholder.ts`) for `TYPE_WINDOW_CONTENT_CHANGED` and
`TYPE_VIEW_SCROLLED` events, and treating a full-height view recycle or a
scroll distance close to one screen height as "one reel."

Say this plainly rather than promise more than the mechanism can deliver:
**this is a heuristic, not a measurement.** It will occasionally miscount a
half-scroll or a fast flick past two at once, and it will need retuning
whenever Instagram, TikTok, or YouTube change their own view hierarchy, which
they do without warning. Budget for that as ongoing maintenance, not a one
time build. This also means the Accessibility Service declaration needs the
written justification `requirements.md`'s open question 10 already flags,
since Play Store review reads accessibility permissions as a red flag by
default and expects a plain explanation of what it is for and what it does
not do (it does not read what was watched, only that a scroll happened).

**Where this runs.** Expo has no stock API for an Android
`AccessibilityService`, so this is a small native Kotlin module plus a config
plugin, not something available through `expo-*` packages directly. The
Kotlin side does all the event filtering and the "is this one reel" heuristic,
because `AccessibilityEvent` objects are cheap and frequent and the
React Native bridge is not. The bridge is crossed on a timer, roughly every
3 to 5 seconds, carrying one aggregated `{ instagram: 4, tiktok: 1 }` style
map, never one bridge call per scroll. Crossing the bridge per event would be
the same mistake as one database row per reel, just one layer earlier.

---

## Local storage: the source of truth for the UI

**Technology: `expo-sqlite`.** Not `AsyncStorage`, not `MMKV`. Stats needs a
7 day range query and a per app grouping, the same shape of query
`backend-plan.md` already writes against Postgres. A real SQL engine on
device means that query is written once, conceptually, and works identically
online or off, rather than one mental model for "the local store" and a
different one for "the server."

```sql
-- Mirrors `daily_usage`. Same reasoning: a total per day, never a row per reel.
create table local_daily_usage (
  usage_date text primary key,       -- 'YYYY-MM-DD', device local calendar day
  total_reels integer not null default 0,   -- what every screen reads
  synced_reels integer not null default 0   -- how much of total_reels the server has confirmed
);

-- Mirrors `daily_app_usage`.
create table local_app_usage (
  usage_date text not null,
  app_key text not null,             -- 'instagram' | 'tiktok' | 'youtube'
  total_reels integer not null default 0,
  synced_reels integer not null default 0,
  primary key (usage_date, app_key)
);
```

`total_reels` is what the tracker bumps the instant a batch of scrolls comes
off the bridge, and what every screen reads. `synced_reels` only ever moves
inside the sync worker below. The gap between the two columns, `total_reels -
synced_reels`, is the pending delta, and it is a subtraction, not a queue of
discrete rows to replay. This is the same "store a total, not an event" rule
from `backend-plan.md`, applied one layer earlier, and it is what makes the
sync step below trivial to reason about: there is never more than one pending
number per day per app to reconcile, no matter how many scrolls produced it.

---

## The sync worker: local first, then push

Runs on three triggers: a timer while the app is foregrounded (every 5
seconds or so, matching the tracker's own flush interval), immediately on the
app going to the background, and on regaining connectivity
(`@react-native-community/netinfo`). One pass:

1. `select * from local_daily_usage where total_reels > synced_reels` (and the
   same against `local_app_usage`). This is at most a handful of rows, one
   per day since the local table only ever grows one row a day.
2. Capture `pending = total_reels - synced_reels` for each row, at that
   moment, before the network call goes out.
3. One batched call to `increment_usage` (already defined in
   `backend-plan.md`), carrying every pending row in a single `jsonb`
   payload, not one call per row and never one call per reel.
4. On success, `synced_reels = synced_reels + pending` for exactly the rows
   sent, using the captured amount rather than re-reading `total_reels`, so a
   scroll that landed during the network round trip is not accidentally
   marked synced before it was ever sent.
5. On failure, change nothing. The row stays pending and the next tick tries
   again. Nothing is lost, because nothing was removed from `total_reels` to
   begin with, only compared against `synced_reels`.

**Offline behavior falls out of this for free.** Counting keeps working with
no connection at all, because it never touched the network to begin with. A
week of airplane mode means a week of rows sitting with a pending delta, and
reconnecting fires one sync pass that sends all seven in the one batched
call, not seven separate catch-up requests. Bound how far back a pending row
can be (say, the same rolling window Stats keeps locally, see below) so a
year of untouched history can never turn into an unbounded payload.

**Two devices, one account** resolves the same way it already does at the
database layer in `backend-plan.md`: `increment_usage` is additive, so two
phones each syncing their own locally counted total for the same day both
land correctly in the one server row. Nothing here needs to know the other
device exists.

---

## Page by page: what is local and what is networked

### Home

The big number and the mascot's stage are a **pure local read**,
`local_daily_usage` for today's date, and update live as the tracker flushes
its batches, with no request in the path at all. This is the number a person
checks compulsively; it must never show a spinner or wait on a round trip.
The stage itself stays a derived value as `backend-plan.md` already says,
`Math.floor(total / 100)`, computed off the local total, not a separate
stored field either place.

The Lock reels row needs `profiles.premium`, which is genuinely a server
value. Fetch it once on launch and again on foreground, cache the last known
answer locally so a cold start never flashes "free" for the half second
before the network responds, and never block the rest of Home's render on it.

### Stats

The 7 day chart, the three tiles, and the per app breakdown are also a local
read for anyone who has had the app installed through that week, since the
tracker has been writing `local_daily_usage` and `local_app_usage` the whole
time regardless of connectivity. This screen is offline capable by
construction, not by extra work.

The gap is a fresh install or a new device: local history does not exist yet
even though the server's does. Stats should do exactly one network hydrate on
first load, calling `weekly_stats()` from `backend-plan.md` to backfill
whatever local rows are missing, then read local for every render after that.
One reconciliation, not a standing dependency.

"Full history beyond 7 days" stays a Pro-gated network call on purpose. Local
storage should only retain a rolling window (30 days is a reasonable
default, see [Open items](#open-items-this-adds)), both to bound the local
database and because a device holding 90 days of history it might never show
is wasted storage for most accounts. Anything past the retained window is a
`weekly_stats`-shaped RPC call with a wider range, same as it would be
without a local cache at all.

### Settings

Counter style, counter position, daily limit, and the notifications toggle
all follow a **write-through** pattern: update a small local single-row
cache immediately, so the row and its sheet reflect the change with no
latency at all, then fire the `profiles` update in the background. This is a
plain `update`, not an additive RPC, since a preference has one current value
rather than a total that accumulates. If that write fails, retry it the same
way the usage sync worker retries, and keep rendering the local value either
way. A toggle that waits on the network before it visibly flips is a toggle
that feels broken even when it isn't.

Dark mode and language stay exactly as `backend-plan.md` already says: device
only, never queued, never synced. Nothing here changes that.

The feedback sheet queues its one message locally (a single row, so no growth
risk) if `submit-feedback` fails to reach the network at send time, and
retries on reconnect, rather than discarding what someone typed.

### Battle (leaderboard)

The one screen that cannot be local-first for anyone but yourself, because
its entire point is other people's numbers. Your own row still renders
instantly from `local_daily_usage`, the same read Home uses, while the rest
of the board loads from `leaderboard_for_me()`.

Cache the last successful board response as one small local blob, not a full
table, so reopening the tab while briefly offline shows the last known
standings with a quiet "may be out of date" note instead of a blank screen.
That is the existing no dead ends rule from `requirements.md`, applied to a
network failure rather than an empty data set. While the screen is open and
online, the Realtime subscription from `backend-plan.md` keeps that cached
copy current; while offline it simply stops updating, which is the correct
and expected behavior rather than a bug to work around.

---

## What this does not change in `backend-plan.md`

No schema changes. `increment_usage` was already written additive-safe for
exactly this reason, this document is what actually exercises that property.
The one thing worth carrying back: a catch-up sync after an offline stretch
should still be one batched call across every pending day, never a burst of
many, so the "batch the whole device into one request" design in
`backend-plan.md` stays true on the client side that actually calls it.

---

## Open items this adds

1. **Heuristic accuracy.** What counts as "one reel" needs tuning per target
   app against its real view hierarchy, and needs revisiting whenever
   Instagram, TikTok, or YouTube ship a UI change that moves the views being
   watched. This is maintenance, not a one time calibration.
2. **The Accessibility Service justification** `requirements.md`'s open
   question 10 already flags moves from a nice-to-have to a hard dependency
   here: there is no fallback method that produces an individual reel count,
   so if that permission does not survive Play Store review, this whole
   counting mechanism needs a different design, not a tweak.
3. **How many days of local history to retain**, bounding
   `local_daily_usage` and `local_app_usage` on device. 30 days is this
   document's default, trading a small amount of on-device storage for a
   month of Stats working fully offline; revisit if that number turns out
   wrong in either direction.
