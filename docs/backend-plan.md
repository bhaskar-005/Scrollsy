# Doomless backend plan

> **Superseded in parts by the build.** The schema is now one account table
> plus four, the app calls a Doomless API rather than Supabase directly, that
> API is a Cloudflare Worker rather than a Supabase Edge Function, and several
> pieces below were dropped. The source of truth is
> `supabase/migrations/20260915000000_init.sql` and `api/src`, and every
> difference is listed with its reason in
> [`docs/checklist.md`](checklist.md#what-changed-from-the-plan). The reasoning
> here, especially "never store an event, store a total", still holds.

What every screen needs from a server, and how to build that server. Companion
to `docs/requirements.md`, the UI spec, and `docs/tracking-and-sync.md`, which
covers what runs on the device before any of this is ever called: counting a
reel, storing it locally, and syncing it here. This document is the data and
infrastructure spec: Supabase schema, auth, onboarding persistence, and which
pieces of logic are a Postgres function versus an Edge Function.

Everything below is written against the screens as they exist in `src/` today
(Home, Stats, Settings, Battle), not the fuller 15 screen spec in
`requirements.md`. Where the two disagree, that is called out rather than
guessed at.

Stack: **Supabase** (Postgres, Auth, Realtime, Storage, Edge Functions). One
backend, no separate API server, because everything here is CRUD plus a
handful of webhooks, and adding a second server just to sit in front of
Postgres would be a network hop for nothing.

---

## Guiding rule: never store an event, store a total

The single biggest cost decision in this app is how reel counts get from the
device to the database. The wrong way is one row per reel scrolled. At any
real usage volume that is millions of rows a day for no benefit, since nothing
in the UI ever reads an individual reel, only sums.

Every table below is a **daily aggregate**, one row per user per day (per app,
where the breakdown matters). A device batches its counts locally and pushes
one upsert every few minutes, or on backgrounding. This keeps every table
sized at `users × days`, not `users × reels`, keeps every query in this
document an indexed range scan, and means a "midnight reset" needs no job to
run: a new day is just a new row.

This rule is why the schema, the RPCs, and the realtime scoping below all
look the way they do. Refer back to it rather than re-justifying it per table.

---

## Home

| Feature | Source today | What it needs |
| --- | --- | --- |
| Header title, avatar | static text, `Account.name` | `profiles.display_name`, `profiles.avatar_url` |
| Sky, dome, star field, mascot glow | pure UI | nothing |
| Mascot stage | `Today.stage`, hand set | computed client side from today's total, see below |
| Big reel count | `Today.reels` | `daily_usage` row for today |
| "reels seen today" label | static copy | nothing |
| Lock reels / Pro row | `ProUpsell`, reads `Account.premium` | `profiles.premium` |

**How it should work.** The stage (`fresh` → `cooked`) is `Math.floor(total /
100)` clamped to the last stage, exactly like `onboarding/concept.tsx` already
computes it. That is a pure function of one integer, so it is **never
stored**, only derived on the client from `daily_usage.total_reels` for
today's date in the device's local timezone. Storing a redundant `stage`
column would just be a second value that can drift from the first.

The count itself comes from one row:

```sql
select total_reels from daily_usage
where user_id = auth.uid() and usage_date = current_date;
```

Written by the `increment_usage` RPC (below), never by a direct client
`update`, so concurrent writes from two devices on the same account never lose
an increment to a stale read.

---

## Stats

| Feature | Source today | What it needs |
| --- | --- | --- |
| Week selector, locked "previous week" | decorative, routes to paywall | `profiles.premium` gate on any query for a range earlier than 7 days back |
| Average a day / best day / worst stage tiles | `Profile.avgPerDay` etc, hand set | computed client side from the 7 rows below |
| 7 day bar chart | `Week` array, hand set | `daily_usage` rows for the trailing 7 days |
| Total reels this week | `Week` summed, hand set | same 7 rows, summed client side |
| Where the week went (per app) | `WeekAppUsage`, hand set | `daily_app_usage` rows for the trailing 7 days, grouped by app |
| Lock reels button | `ProUpsell` | `profiles.premium` |

**How it should work.** One query does almost all of it:

```sql
select usage_date, total_reels from daily_usage
where user_id = auth.uid()
  and usage_date >= current_date - interval '6 days'
order by usage_date;
```

Seven rows. Average, best day, and worst stage are cheap to fold over seven
numbers in JavaScript, so there is no reason to push that arithmetic into a
Postgres aggregate or a view, that would just be another round trip for work
the client can do for free once it already has the rows. The per app
breakdown is the same shape query against `daily_app_usage`, grouped by
`app_key` on the client since it is at most a handful of apps.

"Full history beyond 7 days" (the thing the locked arrow leads to) is the same
query with a wider `interval`, gated by `profiles.premium` in the RLS policy
on `daily_usage` itself, not just in the UI. A client that spoofs its own
request for day 30 should get nothing back if it isn't paid, not a page the
button merely hides.

---

## Settings

| Feature | Source today | What it needs, and where it should live |
| --- | --- | --- |
| Account name, email, avatar | `Account` | `profiles.display_name`, `auth.users.email`, `profiles.avatar_url` |
| Pro row | `ProUpsell` | `profiles.premium` |
| Counter style | `CounterPrefs.style` | `profiles.counter_style`, **synced**, see below |
| Counter position | `CounterPrefs.position` `{x, y}` | `profiles.counter_position_x/y`, **synced** |
| Home screen widget | preview only | nothing new, reads the same `daily_usage` row Home does |
| Friends & battles row | routes to Battle | nothing itself |
| Daily limit | `Profile.dailyLimit`, Pro gated | `profiles.daily_limit`, **synced** |
| Notifications toggle | static `On` | `profiles.notifications_enabled`, **synced** |
| Screen time connection | `Profile.screenTimeConnected` | `profiles.screen_time_granted`, `profiles.overlay_granted` |
| Dark mode toggle | local `useState` | **device only**, never synced, see below |
| Language | `Languages[0]` | **device only** for now, one language exists |
| Send feedback sheet | local state, no send | `feedback` table via an Edge Function |
| Rate on Play Store | `Legal.store` | nothing, external link |
| Replay onboarding | routes to welcome | resets `profiles.onboarding_completed_at` |
| Log out | no-op today | `supabase.auth.signOut()` |
| App version | `Constants.expoConfig` | nothing, local |

**Synced versus device-only, and why.** Counter style, counter position,
daily limit, and the notifications toggle are all synced to `profiles`
because Settings itself needs to read them back on next launch, and because
the overlay counter (Stage 3) is a separate OS-level surface from the app that
also needs to read them, on a possibly cold start where nothing else has run
yet. A preference two different surfaces both read has to live somewhere
both can reach, so it goes to the row anyway.

Dark mode and language are the opposite case. Nothing outside this one screen
on this one device ever reads them, so syncing them would be a network write
for a value only `useColorScheme()` needs. Keep those in `AsyncStorage`
(or `react-native-mmkv` if the write frequency ever justifies it) and never
put them in a request at all. This is the cheapest possible optimization:
the fastest network call is the one you never make.

**Feedback.** Route the send button through an Edge Function rather than a
direct client insert, so the Slack or email webhook the team actually reads
feedback from can live server side as a secret, instead of shipping in the
app bundle where it is trivially extracted.

---

## Battle (leaderboard)

| Feature | Source today | What it needs |
| --- | --- | --- |
| Podium, top 3 | `Board`, sorted client side | ranked friends query |
| Ranked list, 4th down | `Board` | same query |
| Your row highlighted | `entry.you` flag | `id === auth.uid()` on the client |
| Empty seats, invite prompts | `Friends.freeCap` | pending invite / friend count |
| Locked seat past 5, Pro gate | `Friends.freeCap` | `profiles.premium`, enforced server side |
| Profile sheet, rank + reels | `ProfileSheet` | same query, no extra fetch |
| Premium ring and tick on a friend | `entry.premium` | `profiles.premium`, must be readable by friends |

**What "reels" means here is an open decision.** `BoardEntry.reels` today is
a flat placeholder number with no stated period. The simplest design, and the
one this document assumes, is that the leaderboard is **today's** count, the
same number Home shows, so it resets at midnight for everyone at once and
never needs its own aggregate table. If the intent is a weekly battle instead,
swap the `current_date` filter below for the same 7 day range Stats uses.
Write down which one before building this, the query is a one line
difference but the product meaning is not.

```sql
-- one indexed query, run as the signed in user
select p.id, p.display_name, p.avatar_url, p.premium,
       coalesce(d.total_reels, 0) as reels
from friendships f
join profiles p on p.id = f.friend_id
left join daily_usage d
  on d.user_id = f.friend_id and d.usage_date = current_date
where f.user_id = auth.uid() and f.status = 'accepted'
union
select p.id, p.display_name, p.avatar_url, p.premium,
       coalesce(d.total_reels, 0)
from profiles p
left join daily_usage d on d.user_id = p.id and d.usage_date = current_date
where p.id = auth.uid();
```

Wrap this as the `leaderboard_for_me()` RPC below rather than composing it
from the client on every load, so the query plan is fixed once instead of
re-parsed per call, and so a future change to what "reels" means is a one
function edit, not a client release.

**Friend visibility is the one place RLS needs care.** A friend needs to read
your `display_name`, `avatar_url`, and `premium`, but never your `email` or
your raw `daily_usage` rows for days beyond today (that would leak your full
history to anyone who added you). Expose a narrow `public.friend_profiles`
view carrying only the three safe columns, and put the "friends only" RLS
policy on the view, not on `profiles` itself. `profiles` stays readable only
by its own owner.

**The five friend cap must be enforced in the database**, with a check
constraint or an `accept_invite` RPC that counts existing accepted rows before
inserting a sixth for a non-premium account. The client can grey out the
button, but a client is not a trust boundary, only the database's own
constraint is.

---

## Accounts and onboarding

**Sign in.** Google only, matching `onboarding/welcome.tsx`. Use
`@react-native-google-signin/google-signin` to get a Google ID token on
device, then one call:

```ts
await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
```

This is worth calling out because it is the efficient path: it skips the
generic OAuth web-view redirect round trip (open browser, redirect back,
exchange code) that `supabase.auth.signInWithOAuth()` would otherwise need,
at the cost of one extra native SDK. For a mobile-only app with no email/password
fallback, that trade is worth making.

**Row creation.** A trigger on `auth.users`, not a client side "create my
profile" call after login:

```sql
create function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

This removes an entire round trip from the sign-up path and makes it
impossible to end up with an `auth.users` row and no matching `profiles` row,
a state every one of the queries above would otherwise have to guard against.

**What each onboarding step persists**, matching the six screens that exist
today, `welcome`, `concept`, `permission`, `notifications`, `friends`,
`paywall`. `requirements.md` also lists a `limit` step that is not built yet,
included in its own row below.

| Step | Screen | Persists |
| --- | --- | --- |
| Welcome | `onboarding/welcome.tsx` | the sign in itself |
| Concept | `onboarding/concept.tsx` | nothing, it is a one time explainer, replayable, no state to keep |
| Permission | `onboarding/permission.tsx` | `profiles.screen_time_granted`, `profiles.overlay_granted` |
| Notifications | `onboarding/notifications.tsx` | `profiles.notifications_enabled`, and the device push token into `push_tokens` on `Enable` |
| Friends | `onboarding/friends.tsx` | an `invites` row per name added, or nothing on `Scroll alone` |
| Paywall | `onboarding/paywall.tsx` | a `subscriptions` row, written by the store webhook once checkout completes, never written directly by this screen |
| *(not built)* Daily limit | `requirements.md` step 04 | would write `profiles.daily_limit` |

Stamp `profiles.onboarding_completed_at = now()` once the flow reaches Home,
and gate the `index.tsx` redirect on that column instead of always sending
every launch to `/onboarding/welcome` the way it does today.

---

## Supabase schema

```sql
-- One row per user. Extends auth.users, which Supabase already manages.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  daily_limit int not null default 400,
  counter_style text not null default 'pill',
  counter_position_x real not null default 0.86,
  counter_position_y real not null default 0.08,
  notifications_enabled boolean not null default true,
  screen_time_granted boolean not null default false,
  overlay_granted boolean not null default false,
  onboarding_completed_at timestamptz,
  -- Denormalized from `subscriptions`. Only the webhook function writes this.
  -- Every other read of "is this user Pro" is a single indexed boolean, never a join.
  premium boolean not null default false,
  streak_days int not null default 0,
  created_at timestamptz not null default now()
);

-- One row per user per day. The whole app's usage data lives here.
create table public.daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  total_reels int not null default 0,
  primary key (user_id, usage_date)
);
create index daily_usage_recent on public.daily_usage (user_id, usage_date desc);

-- One row per user per day per app. Powers the two "where it went" cards.
create table public.daily_app_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  app_key text not null, -- 'instagram' | 'tiktok' | 'youtube', matches AppUsageEntry.icon
  reels int not null default 0,
  primary key (user_id, usage_date, app_key)
);
create index daily_app_usage_recent on public.daily_app_usage (user_id, usage_date desc);

-- Symmetric pairs, written together on accept, so a lookup from either side is a plain index hit.
create table public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);
create index friendships_by_friend on public.friendships (friend_id, status);

create table public.invites (
  code text primary key,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by uuid references auth.users(id)
);

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_by_user on public.push_tokens (user_id);

-- Source of truth for entitlement. Written only by the store webhook function.
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('play_store', 'app_store')),
  product_id text not null,
  status text not null check (status in ('trialing', 'active', 'canceled', 'expired')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  topic text not null check (topic in ('bug', 'idea', 'billing', 'other')),
  message text not null,
  created_at timestamptz not null default now()
);

-- The only columns a friend is allowed to see. friend RLS policies point at
-- this view, never at `profiles` itself.
create view public.friend_profiles as
  select id, display_name, avatar_url, premium from public.profiles;
```

**Row level security, one line per table:**

| Table | Policy |
| --- | --- |
| `profiles` | select/update where `id = auth.uid()`. No insert policy, the trigger uses `security definer`. |
| `friend_profiles` (view) | select where `id` is in the caller's accepted `friendships`, or `id = auth.uid()` |
| `daily_usage` | select/insert/update where `user_id = auth.uid()`, and only through `increment_usage` for writes. Rows older than 7 days additionally require `profiles.premium` |
| `daily_app_usage` | same shape as `daily_usage` |
| `friendships` | select where `auth.uid()` is `user_id` or `friend_id`. Insert only through `accept_invite` |
| `invites` | select/insert where `inviter_id = auth.uid()`; `used_by` set only through `accept_invite` |
| `push_tokens` | select/insert/delete where `user_id = auth.uid()` |
| `subscriptions` | select where `user_id = auth.uid()`. No client insert or update policy at all, service role only |
| `feedback` | insert where `user_id = auth.uid()` or null; no select policy for regular users |

---

## Postgres functions versus Edge Functions

Not everything server side needs to be a Deno Edge Function. A `plpgsql` RPC
runs inside Postgres itself, so it skips a network hop that an Edge Function
cannot avoid, and it gets `auth.uid()` for free from the request's own JWT.
Reach for an Edge Function only when the job needs a secret the database
shouldn't hold, talks to a third party, or has to run on a schedule.

### RPCs (`supabase.rpc(...)`, no separate deploy, cheapest option)

- **`increment_usage(p_days jsonb)`**. The one write path for all usage data,
  and the one the device's sync worker calls (see
  `docs/tracking-and-sync.md`). Takes every pending day in a single request,
  not one call per day and never one call per reel:
  ```json
  [
    { "date": "2026-09-14", "total": 42, "apps": { "instagram": 30, "tiktok": 12 } },
    { "date": "2026-09-15", "total": 18, "apps": { "youtube": 18 } }
  ]
  ```
  ```sql
  create or replace function public.increment_usage(p_days jsonb)
  returns void language plpgsql security invoker as $$
  declare
    day jsonb;
    app_key text;
    app_reels int;
  begin
    for day in select * from jsonb_array_elements(p_days) loop
      insert into daily_usage (user_id, usage_date, total_reels)
      values (auth.uid(), (day->>'date')::date, (day->>'total')::int)
      on conflict (user_id, usage_date)
      do update set total_reels = daily_usage.total_reels + excluded.total_reels;

      for app_key, app_reels in select key, value::int from jsonb_each_text(day->'apps') loop
        insert into daily_app_usage (user_id, usage_date, app_key, reels)
        values (auth.uid(), (day->>'date')::date, app_key, app_reels)
        on conflict (user_id, usage_date, app_key)
        do update set reels = daily_app_usage.reels + excluded.reels;
      end loop;
    end loop;
  end;
  $$;
  ```
  Called on the device's own timer while it is actively counting, and once
  more on backgrounding or on regaining connectivity, always with whatever
  days are currently pending. `on conflict ... do update set x = x +
  excluded.x` is what makes two devices, or a retried request after a dropped
  connection, safe to call twice: the write adds to whatever is already
  there instead of replacing it, so a duplicate or late arriving call can
  never overwrite a newer total with a stale one.

- **`leaderboard_for_me()`**. The query in the [Battle](#battle-leaderboard)
  section above, wrapped as a function so its plan is prepared once.

- **`weekly_stats()`**. The 7 day range query from [Stats](#stats), plus the
  matching `daily_app_usage` rows, returned as two result sets so the client
  does the averaging.

- **`accept_invite(p_code text)`**. Validates the code, checks the free tier
  cap (`select count(*) from friendships where user_id = auth.uid() and
  status = 'accepted'`), and inserts both directions of the `friendships` row
  in one transaction. Rejects with an error the client turns into "friend
  list full" rather than silently doing nothing.

### Edge Functions (Deno, for secrets and third parties)

- **`store-webhook`**. Receives the Play Store / App Store (or RevenueCat, if
  that is the layer in front of them) subscription event, verifies its
  signature with a secret that must never reach the client, and writes
  `subscriptions` plus the denormalized `profiles.premium` flag. This is the
  only writer either table has.
- **`send-push`**. Reads `push_tokens` for a user and calls the Expo Push
  API. Triggered by a Postgres webhook (`pg_net`) firing when `increment_usage`
  crosses a stage boundary or the daily limit, so the push logic itself never
  runs inside the hot write path.
- **`submit-feedback`**. Inserts into `feedback` and forwards the message to
  wherever the team actually reads it (Slack webhook, email), keeping that
  webhook URL server side.

### Scheduled (`pg_cron`, inside Postgres, no Edge Function needed)

- **Streak rollover**, once a day. Because `daily_usage` is date keyed,
  "midnight reset" is not a job, a new day is automatically a fresh row with
  no total on it. The only thing that needs a nightly job is deciding whether
  yesterday's streak continues, which reads one row per active user and
  writes `profiles.streak_days`. Per-user timezone versus a single UTC
  midnight for everyone is an open call, the same shape of question as
  `requirements.md`'s open questions list, and is worth settling before this
  job is written rather than after.

---

## Client-side efficiency

- **Never poll a screen that isn't open.** Fetch on focus with a short
  `staleTime` (TanStack Query fits this well): Home and Stats every visit,
  Settings cached until the user changes something. Hold a **Realtime**
  subscription only on Battle, scoped to the caller's accepted friend ids,
  and only while that screen is mounted, since it is the one place a live
  number actually matters to the feel of the product. Everywhere else, an
  open socket is doing work for a screen nobody is looking at.
- **One increment call, not one call per app.** The device already knows the
  per-app split locally before it syncs, so `increment_usage` takes the whole
  batch as one `jsonb` payload and writes every row in one transaction,
  rather than the client looping a call per app.
- **Device-only state stays on the device.** Covered above under Settings:
  dark mode and language never leave `AsyncStorage`. Every avoided network
  call is both faster and one less thing that can fail on a bad connection.
- **Index every column a `where` or `order by` above touches.** Each table's
  create statement above already carries its index; if a new query is added
  later, add its index in the same migration, not after someone notices a
  slow query in production.

---

## Open items this plan surfaces

In the same spirit as `requirements.md`'s own open questions, these are
decisions this document had to assume an answer to, written down so they get
revisited on purpose rather than by accident:

1. **What period the leaderboard ranks on.** Assumed today's count, same as
   Home. If it should be weekly instead, it is a one line change to
   `leaderboard_for_me()`, but it changes what "winning" means to a user and
   should be a product call, not a schema accident.
2. **Per-user timezone for the daily/midnight boundary.** `usage_date` is a
   plain `date`. Whether that date is computed in UTC or in each user's own
   timezone changes when a day "resets" for them, and affects streaks more
   than anything else.
3. **The `limit` onboarding step** in `requirements.md` (04, pick 120/240/400)
   is not built in `src/onboarding` yet. `profiles.daily_limit` is ready for
   it whenever it lands.
4. **Which store webhook.** Whether purchases route through RevenueCat or
   direct Play Store / App Store server notifications changes the payload
   `store-webhook` parses, not the tables it writes to.
