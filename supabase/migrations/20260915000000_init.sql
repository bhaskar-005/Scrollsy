-- Doomless initial schema. See docs/backend-plan.md for the reasoning and
-- docs/checklist.md for what changed from that plan while building it.
--
-- Shape: one table per account, `profiles`, holding everything that is a single
-- fact about that person, and the tables around it for what cannot be a
-- column: usage (many rows per person), friendships (many to many), feedback
-- (a log), and onboarding progress (per install, since it starts before there
-- is an account).
--
-- Access: clients read their own rows through RLS and write almost nothing
-- directly. Every write that needs validation, touches another person, or has
-- to be atomic goes through a security definer function, and every table
-- revokes the grants Supabase hands `anon` and `authenticated` by default, so
-- the only way in is the way this file opens.

-- ---------------------------------------------------------------------------
-- profiles: the account. Created by trigger on sign up.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  display_name text not null default '',
  avatar_url text,

  -- Preferences. The only columns a person can write, see the grant below.
  daily_limit integer not null default 400 check (daily_limit between 1 and 10000),
  counter_style text not null default 'pill'
    check (counter_style in ('pill', 'outline', 'glass', 'plain', 'mascot')),
  counter_position_x real not null default 0.86 check (counter_position_x between 0 and 1),
  counter_position_y real not null default 0.08 check (counter_position_y between 0 and 1),
  notifications_enabled boolean not null default false,
  screen_time_granted boolean not null default false,
  overlay_granted boolean not null default false,

  -- One live invite at a time, reused until it runs out, so a link dropped in a
  -- group chat works for everyone in it. Written only by create_invite.
  invite_code text unique,
  invite_expires_at timestamptz,

  -- Written only by apply_subscription, from the RevenueCat webhook.
  subscription_status text not null default 'none'
    check (subscription_status in ('none', 'trialing', 'active', 'canceled', 'expired')),
  subscription_product_id text,
  subscription_store text,
  -- Null for a purchase that never runs out.
  subscription_expires_at timestamptz,

  -- Derived, never written. A cancelled plan stays Pro until RevenueCat reports
  -- it expired, so every "is this person Pro" read is one column, no join.
  premium boolean generated always as (subscription_status in ('trialing', 'active', 'canceled')) stored,

  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Read own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Column level. Subscription, invite and premium columns stay out of reach even
-- on a person's own row.
grant update (
  display_name,
  avatar_url,
  daily_limit,
  counter_style,
  counter_position_x,
  counter_position_y,
  notifications_enabled,
  screen_time_granted,
  overlay_granted
) on public.profiles to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1),
      ''
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Used inside RLS policies, so it is stable and wrapped in a select at each
-- call site, which lets Postgres evaluate it once per query, not once per row.
create function public.is_premium()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.premium from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function public.is_premium() from public, anon;
grant execute on function public.is_premium() to authenticated;

-- Writes a person's subscription from RevenueCat's current record of them.
-- Service role only. `premium` follows on its own, being generated.
--
-- An id RevenueCat knows but this database does not (a deleted account, a test
-- purchase) is ignored rather than raised, because raising makes RevenueCat
-- retry a delivery that can never succeed.
create function public.apply_subscription(
  p_user uuid,
  p_status text,
  p_product_id text,
  p_store text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set
    subscription_status = p_status,
    subscription_product_id = p_product_id,
    subscription_store = p_store,
    subscription_expires_at = p_expires_at
  where id = p_user;
end;
$$;

revoke execute on function public.apply_subscription(uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_subscription(uuid, text, text, text, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- daily_usage: one row per person, per day, per app. A day's total is the sum
-- of its app rows, so a total and its breakdown can never disagree.
-- ---------------------------------------------------------------------------

create table public.daily_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  usage_date date not null,
  app_key text not null check (app_key in ('instagram', 'tiktok', 'youtube')),
  reels integer not null default 0 check (reels >= 0),
  -- Also serves every range query in the app: by person, by date, in either
  -- direction. No second index needed.
  primary key (user_id, usage_date, app_key)
);

alter table public.daily_usage enable row level security;

create policy "Read own last 7 days, or all of it with Pro" on public.daily_usage
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and (usage_date >= current_date - 6 or (select public.is_premium()))
  );

revoke all on public.daily_usage from anon, authenticated;
grant select on public.daily_usage to authenticated;

-- The single write path for usage. The device sends every pending day in one
-- call. Additive, so a retried or duplicated call adds rather than overwrites.
--
-- p_days: [{ "date": "2026-09-15", "apps": { "instagram": 30, "tiktok": 12 } }]
--
-- Anything the server cannot store is skipped rather than raised: a day past
-- the 30 day window, a future date from a wrong device clock, an app key this
-- schema does not know yet. Raising would fail the whole batch, the device
-- would retry it forever, and one bad day would block every good one behind it.
create function public.increment_usage(p_days jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  day jsonb;
  day_date date;
  app record;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if coalesce(jsonb_typeof(p_days), '') <> 'array' or jsonb_array_length(p_days) > 31 then
    raise exception 'usage_payload_invalid' using errcode = '22023';
  end if;

  for day in select value from jsonb_array_elements(p_days) loop
    continue when coalesce(jsonb_typeof(day -> 'apps'), '') <> 'object';
    continue when coalesce(day ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$';

    day_date := (day ->> 'date')::date;
    continue when day_date not between current_date - 30 and current_date + 1;

    for app in select key, value from jsonb_each(day -> 'apps') loop
      continue when app.key not in ('instagram', 'tiktok', 'youtube');
      continue when jsonb_typeof(app.value) <> 'number';
      continue when (app.value)::numeric <= 0;

      insert into public.daily_usage (user_id, usage_date, app_key, reels)
      values (me, day_date, app.key, least((app.value)::numeric, 5000)::integer)
      on conflict (user_id, usage_date, app_key)
      do update set reels = public.daily_usage.reels + excluded.reels;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.increment_usage(jsonb) from public, anon;
grant execute on function public.increment_usage(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- friendships: both directions stored, written together, only by accept_invite
-- ---------------------------------------------------------------------------

create table public.friendships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- The primary key covers lookups by user_id. This one keeps the cascade on
-- account deletion from scanning the table for the other direction.
create index friendships_friend_id_idx on public.friendships (friend_id);

alter table public.friendships enable row level security;

create policy "Read own friendships" on public.friendships
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

-- Hands back the person's live invite code, minting a fresh one only when there
-- is none or it has less than a day left, so tapping invite ten times reuses
-- one code instead of leaving ten behind.
create function public.create_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  code text;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.profiles set
    invite_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    invite_expires_at = now() + interval '7 days'
  where id = me
    and (invite_code is null or invite_expires_at <= now() + interval '1 day');

  select p.invite_code into code from public.profiles p where p.id = me;
  return code;
end;
$$;

revoke execute on function public.create_invite() from public, anon;
grant execute on function public.create_invite() to authenticated;

-- Free accounts stop at 5 friends. Internal, called only from accept_invite.
create function public.friend_cap_reached(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not p.premium
    and (select count(*) from public.friendships f where f.user_id = p_user) >= 5
  from public.profiles p
  where p.id = p_user;
$$;

revoke execute on function public.friend_cap_reached(uuid) from public, anon, authenticated;

-- Returns the inviter's id. Raises a named error the client maps to copy:
-- invite_invalid, invite_own, friend_cap_self, friend_cap_inviter.
create function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  inviter uuid;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select p.id into inviter
  from public.profiles p
  where p.invite_code = p_code and p.invite_expires_at > now();

  if inviter is null then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;

  if inviter = me then
    raise exception 'invite_own' using errcode = 'P0001';
  end if;

  -- Lock both profiles in a fixed order, so two accepts racing for the last
  -- free seat run one after the other instead of both passing the count.
  perform 1 from public.profiles where id in (me, inviter) order by id for update;

  -- A second tap on the same link is a no-op, not an error.
  if exists (select 1 from public.friendships where user_id = me and friend_id = inviter) then
    return inviter;
  end if;

  if public.friend_cap_reached(me) then
    raise exception 'friend_cap_self' using errcode = 'P0001';
  end if;

  if public.friend_cap_reached(inviter) then
    raise exception 'friend_cap_inviter' using errcode = 'P0001';
  end if;

  insert into public.friendships (user_id, friend_id) values (me, inviter), (inviter, me);
  return inviter;
end;
$$;

revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- Security definer so it can read friends' profiles and usage, which RLS keeps
-- private. It returns only what a friend may see: never an email, never an
-- invite code, never any day but the one asked for.
--
-- p_date is the device's own calendar day, bounded to a day either side of the
-- server's, which is timezone slack and nothing more.
create function public.leaderboard_for_me(p_date date)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  premium boolean,
  reels integer,
  is_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_date is null or p_date not between current_date - 1 and current_date + 1 then
    raise exception 'leaderboard_date_out_of_range' using errcode = '22023';
  end if;

  return query
  with people as (
    select me as person_id
    union
    select f.friend_id from public.friendships f where f.user_id = me
  )
  select
    p.id,
    p.display_name,
    p.avatar_url,
    p.premium,
    coalesce(
      (select sum(d.reels)::integer
       from public.daily_usage d
       where d.user_id = p.id and d.usage_date = p_date),
      0
    ),
    p.id = me
  from people
  join public.profiles p on p.id = people.person_id
  order by 5 asc, p.display_name asc;
end;
$$;

revoke execute on function public.leaderboard_for_me(date) from public, anon;
grant execute on function public.leaderboard_for_me(date) to authenticated;

-- ---------------------------------------------------------------------------
-- feedback: inserted straight from the app, read by the team in the dashboard
-- ---------------------------------------------------------------------------

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  topic text not null check (topic in ('bug', 'idea', 'billing', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Send feedback as yourself" on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.feedback from anon, authenticated;
grant insert (topic, message) on public.feedback to authenticated;

-- ---------------------------------------------------------------------------
-- onboarding_progress: one row per install, so a person resumes where they
-- stopped and the team can see which step people leave at.
--
-- Keyed by an install id rather than the account, because the first step is
-- the sign in itself. Keyed by account alone, everyone who quit on the welcome
-- screen would be invisible, and that is the drop off worth seeing most.
-- The row links to the account once the person signs in.
-- ---------------------------------------------------------------------------

create table public.onboarding_progress (
  -- Random, generated on the device, never shown. Knowing it is what lets a
  -- caller write to the row, so it is only as private as the device keeps it.
  install_id uuid primary key,
  -- Kept as null when the account is deleted, so the funnel stays whole with no
  -- personal data left on the row.
  user_id uuid references public.profiles (id) on delete set null,
  current_step text not null,
  furthest_step text not null,
  -- When this install first reached each step, { "concept": "2026-..." }, for
  -- time spent per step. First visits only, so replaying onboarding changes
  -- nothing here.
  reached_at jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Only rows with an account are ever looked up by account.
create index onboarding_progress_user_id_idx on public.onboarding_progress (user_id)
  where user_id is not null;

alter table public.onboarding_progress enable row level security;
revoke all on public.onboarding_progress from anon, authenticated;

-- Where a step sits in the flow. Null for anything that is not a step.
create function public.onboarding_step_rank(p_step text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select array_position(
    array['welcome', 'concept', 'permission', 'notifications', 'friends', 'paywall', 'done'],
    p_step
  );
$$;

alter table public.onboarding_progress
  add constraint onboarding_progress_steps_valid check (
    public.onboarding_step_rank(current_step) is not null
    and public.onboarding_step_rank(furthest_step) is not null
  );

-- Records that this install reached a step. Callable before sign in, as anon.
-- One upsert on the primary key, whatever happened before.
--
-- The furthest step only ever moves forward, the first reached time of a step
-- is never overwritten, and completion is stamped once. A row that belongs to
-- an account is left alone by anyone else, signed in or not.
create function public.record_onboarding_step(p_install_id uuid, p_step text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if p_install_id is null or public.onboarding_step_rank(p_step) is null then
    raise exception 'onboarding_step_invalid' using errcode = '22023';
  end if;

  insert into public.onboarding_progress as progress
    (install_id, user_id, current_step, furthest_step, reached_at, completed_at)
  values (
    p_install_id,
    me,
    p_step,
    p_step,
    jsonb_build_object(p_step, now()),
    case when p_step = 'done' then now() end
  )
  on conflict (install_id) do update set
    user_id = coalesce(progress.user_id, excluded.user_id),
    current_step = excluded.current_step,
    furthest_step = case
      when public.onboarding_step_rank(excluded.furthest_step) > public.onboarding_step_rank(progress.furthest_step)
      then excluded.furthest_step
      else progress.furthest_step
    end,
    -- Keys on the right win in a jsonb merge, so existing first visits stay.
    reached_at = excluded.reached_at || progress.reached_at,
    completed_at = coalesce(progress.completed_at, excluded.completed_at),
    updated_at = now()
  where progress.user_id is null or progress.user_id = me;
end;
$$;

revoke execute on function public.record_onboarding_step(uuid, text) from public;
grant execute on function public.record_onboarding_step(uuid, text) to anon, authenticated;

-- Where to pick up. For a signed in person it also looks across every install
-- their account has used, so a new phone resumes too. Returns no row when
-- nothing is known, which means start from the beginning.
create function public.onboarding_resume(p_install_id uuid)
returns table (step text, completed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (array_agg(p.furthest_step order by public.onboarding_step_rank(p.furthest_step) desc))[1],
    bool_or(p.completed_at is not null)
  from public.onboarding_progress p
  where p.install_id = p_install_id
     or ((select auth.uid()) is not null and p.user_id = (select auth.uid()))
  having count(*) > 0;
$$;

revoke execute on function public.onboarding_resume(uuid) from public;
grant execute on function public.onboarding_resume(uuid) to anon, authenticated;

-- For the team, in the dashboard's SQL editor. How many installs reached each
-- step, and how many stopped there. Not exposed through the API.
--
-- select * from public.onboarding_funnel;
create view public.onboarding_funnel
with (security_invoker = true)
as
select
  steps.step,
  count(progress.install_id) as reached,
  count(progress.install_id)
    - lead(count(progress.install_id), 1, 0::bigint) over (order by steps.position) as stopped_here
from unnest(array['welcome', 'concept', 'permission', 'notifications', 'friends', 'paywall', 'done'])
  with ordinality as steps (step, position)
left join public.onboarding_progress progress
  on public.onboarding_step_rank(progress.furthest_step) >= steps.position
group by steps.step, steps.position
order by steps.position;

revoke all on public.onboarding_funnel from anon, authenticated;

-- ---------------------------------------------------------------------------
-- invite_preview: who sent a link, for the invite web page, before the person
-- holding it has the app or an account. Only a name and a photo, for a live
-- code. Never counts, which a link passed around a group chat should not show.
-- ---------------------------------------------------------------------------

create function public.invite_preview(p_code text)
returns table (name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name, p.avatar_url
  from public.profiles p
  where p.invite_code = p_code and p.invite_expires_at > now();
$$;

revoke execute on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;
