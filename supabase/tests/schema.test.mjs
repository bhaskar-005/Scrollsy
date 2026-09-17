// Runs supabase/migrations against real Postgres (PGlite) with Supabase's auth
// roles stubbed, then exercises every access rule as an actual signed in user.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const db = new PGlite();
let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

async function expectError(name, fn, fragment) {
  try {
    await fn();
    check(name, false, `(expected error containing "${fragment}", got success)`);
  } catch (error) {
    check(name, String(error.message).includes(fragment), `(got "${error.message}")`);
  }
}

/** Run fn as a signed in user, the way PostgREST would: role plus JWT sub. */
async function as(uid, fn, role = 'authenticated') {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

const rows = async (sql, params) => (await db.query(sql, params)).rows;

// --- Supabase bootstrap: the pieces of a real project this migration relies on
await db.exec(`
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  -- Supabase grants everything in public to these roles by default. The
  -- migration has to revoke its way down from here, so the test does too.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

for (const file of readdirSync(MIGRATIONS).sort()) {
  await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  console.log(`applied ${file}`);
}

const ids = {};
for (const name of ['ravi', 'anya', 'dev', 'c1', 'c2', 'c3', 'c4', 'c5']) {
  ids[name] = crypto.randomUUID();
}
for (const [name, id] of Object.entries(ids)) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    `${name}@example.com`,
    name === 'ravi' ? { full_name: 'Ravi Menon', picture: 'https://g/ravi.png' } : {},
  ]);
}

const today = (await rows(`select current_date::text as d`))[0].d;
const shift = async (days) => (await rows(`select (current_date + $1::int)::text as d`, [days]))[0].d;

console.log('\nprofiles');
const ravi = await rows(`select * from public.profiles where id = $1`, [ids.ravi]);
check('trigger creates a profile on sign up', ravi.length === 1);
check('display name from Google full_name', ravi[0]?.display_name === 'Ravi Menon');
check('avatar falls back to picture', ravi[0]?.avatar_url === 'https://g/ravi.png');
const anya = await rows(`select display_name from public.profiles where id = $1`, [ids.anya]);
check('display name falls back to email local part', anya[0]?.display_name === 'anya');

await as(ids.ravi, async () => {
  const visible = await rows(`select id from public.profiles`);
  check('a user sees only their own profile', visible.length === 1 && visible[0].id === ids.ravi);
  await db.query(`update public.profiles set counter_style = 'glass', counter_position_x = 0.5 where id = $1`, [ids.ravi]);
  const updated = await rows(`select counter_style from public.profiles`);
  check('a user can update their own preferences', updated[0].counter_style === 'glass');
  await expectError('premium cannot be written at all, being derived',
    () => db.query(`update public.profiles set premium = true where id = $1`, [ids.ravi]), 'can only be updated to DEFAULT');
  await expectError('a user cannot write the subscription that premium is derived from',
    () => db.query(`update public.profiles set subscription_status = 'active' where id = $1`, [ids.ravi]), 'permission denied');
  await expectError('a bad counter style is rejected',
    () => db.query(`update public.profiles set counter_style = 'neon' where id = $1`, [ids.ravi]), 'violates check');
  const other = await db.query(`update public.profiles set daily_limit = 5 where id = $1`, [ids.anya]);
  check("a user cannot update someone else's profile", other.affectedRows === 0);
});

console.log('\nincrement_usage');
await as(ids.ravi, async () => {
  await expectError('direct inserts into daily_usage are refused',
    () => db.query(`insert into public.daily_usage values ($1, current_date, 'tiktok', 1)`, [ids.ravi]), 'permission denied');

  const yesterday = await shift(-1);
  const batch = [
    { date: today, apps: { instagram: 10, tiktok: 5 } },
    { date: yesterday, apps: { youtube: 3 } },
  ];
  await db.query(`select public.increment_usage($1)`, [JSON.stringify(batch)]);
  await db.query(`select public.increment_usage($1)`, [JSON.stringify(batch)]);

  const mine = await rows(`select usage_date::text as d, app_key, reels from public.daily_usage order by 1, 2`);
  const insta = mine.find((r) => r.d === today && r.app_key === 'instagram');
  check('a batch of several days lands in one call', mine.length === 3);
  check('a repeated call adds rather than overwrites', insta?.reels === 20);

  const junk = [
    { date: await shift(-40), apps: { instagram: 9 } },
    { date: await shift(5), apps: { instagram: 9 } },
    { date: today, apps: { snapchat: 9, tiktok: -4, youtube: 'lots' } },
    { date: null, apps: { instagram: 9 } },
    { apps: { instagram: 9 } },
    { date: today, apps: { youtube: 999999 } },
  ];
  await db.query(`select public.increment_usage($1)`, [JSON.stringify(junk)]);
  const after = await rows(`select usage_date::text as d, app_key, reels from public.daily_usage order by 1, 2`);
  const tube = after.find((r) => r.d === today && r.app_key === 'youtube');
  check('stale, future, unknown, negative and malformed entries are skipped, not raised',
    after.length === 4 && tube?.reels === 5000, JSON.stringify(after));
  check('an absurd count is clamped to 5000', tube?.reels === 5000);
  await expectError('a payload that is not an array is refused',
    () => db.query(`select public.increment_usage($1)`, [JSON.stringify({ date: today })]), 'usage_payload_invalid');
  await expectError('a null payload is refused',
    () => db.query(`select public.increment_usage(null)`), 'usage_payload_invalid');
});

await as(null, async () => {
  await expectError('anon cannot call increment_usage',
    () => db.query(`select public.increment_usage('[]')`), 'permission denied');
}, 'anon');

console.log('\nhistory gate');
await db.query(`insert into public.daily_usage values ($1, current_date - 20, 'tiktok', 7)`, [ids.ravi]);
await as(ids.ravi, async () => {
  const old = await rows(`select 1 from public.daily_usage where usage_date = current_date - 20`);
  check('a free user cannot read usage older than 7 days', old.length === 0);
});
await db.query(`update public.profiles set subscription_status = 'active' where id = $1`, [ids.ravi]);
await as(ids.ravi, async () => {
  const old = await rows(`select 1 from public.daily_usage where usage_date = current_date - 20`);
  check('a Pro user can', old.length === 1);
});
await db.query(`update public.profiles set subscription_status = 'none' where id = $1`, [ids.ravi]);
await as(ids.anya, async () => {
  const theirs = await rows(`select 1 from public.daily_usage`);
  check("a user cannot read anyone else's usage", theirs.length === 0);
});

console.log('\ninvites and friendships');
let code;
await as(ids.ravi, async () => {
  code = (await rows(`select public.create_invite() as code`))[0].code;
  const again = (await rows(`select public.create_invite() as code`))[0].code;
  check('create_invite returns a code', typeof code === 'string' && code.length === 12);
  check('a second tap reuses the live code', again === code);
  await expectError('accepting your own invite is refused',
    () => db.query(`select public.accept_invite($1)`, [code]), 'invite_own');
  await expectError('a user cannot set their own invite code',
    () => db.query(`update public.profiles set invite_code = 'mine' where id = $1`, [ids.ravi]), 'permission denied');
  const own = await rows(`select invite_code from public.profiles`);
  check('the live code is readable on your own profile', own[0].invite_code === code);
});

await as(ids.anya, async () => {
  const inviter = (await rows(`select public.accept_invite($1) as id`, [code]))[0].id;
  check('accept_invite returns the inviter', inviter === ids.ravi);
  await db.query(`select public.accept_invite($1)`, [code]);
  const mine = await rows(`select friend_id from public.friendships`);
  check('a second accept is a no-op, and a user sees only their own side',
    mine.length === 1 && mine[0].friend_id === ids.ravi);
  await expectError('an unknown code is refused', () => db.query(`select public.accept_invite('nope')`), 'invite_invalid');
  await expectError('friendships cannot be written directly',
    () => db.query(`insert into public.friendships values ($1, $2)`, [ids.anya, ids.dev]), 'permission denied');
});

const both = await rows(`select count(*)::int as n from public.friendships`);
check('both directions are stored', both[0].n === 2);

await as(null, async () => {
  const shown = await rows(`select * from public.invite_preview($1)`, [code]);
  check('anyone holding a live code sees who sent it', shown.length === 1 && shown[0].name === 'Ravi Menon');
  check('and only a name and a photo', Object.keys(shown[0]).sort().join() === 'avatar_url,name');
  check('an unknown code shows nobody', (await rows(`select * from public.invite_preview('ffffffffffff')`)).length === 0);
}, 'anon');
await db.query(`update public.profiles set invite_expires_at = now() - interval '1 minute' where invite_code = $1`, [code]);
await as(null, async () => {
  check('an expired code shows nobody', (await rows(`select * from public.invite_preview($1)`, [code])).length === 0);
}, 'anon');
await as(ids.dev, async () => {
  await expectError('an expired code is refused', () => db.query(`select public.accept_invite($1)`, [code]), 'invite_invalid');
});
await db.query(`update public.profiles set invite_expires_at = now() + interval '7 days' where invite_code = $1`, [code]);

console.log('\nfriend cap');
for (const name of ['dev', 'c1', 'c2', 'c3']) {
  await as(ids[name], () => db.query(`select public.accept_invite($1)`, [code]));
}
const count = await rows(`select count(*)::int as n from public.friendships where user_id = $1`, [ids.ravi]);
check('a free user fills five seats', count[0].n === 5);
await as(ids.c4, async () => {
  await expectError('the sixth is refused while the inviter is free',
    () => db.query(`select public.accept_invite($1)`, [code]), 'friend_cap_inviter');
});
await db.query(`update public.profiles set subscription_status = 'active' where id = $1`, [ids.ravi]);
await as(ids.c4, async () => {
  await db.query(`select public.accept_invite($1)`, [code]);
  check('Pro lifts the cap', true);
});
await as(ids.anya, async () => {
  await expectError('friend_cap_reached is internal only',
    () => db.query(`select public.friend_cap_reached($1)`, [ids.ravi]), 'permission denied');
});

console.log('\nleaderboard');
await as(ids.anya, () => db.query(`select public.increment_usage($1)`, [JSON.stringify([{ date: today, apps: { tiktok: 2 } }])]));
await as(ids.ravi, async () => {
  const board = await rows(`select * from public.leaderboard_for_me($1::date)`, [today]);
  const me = board.find((r) => r.is_me);
  check('the board holds you and every friend', board.length === 7, `(got ${board.length})`);
  check('your own total sums every app', me?.reels === 5000 + 20 + 10, `(got ${me?.reels})`);
  check('fewest reels ranks first', board[0].reels <= board[board.length - 1].reels);
  check('nobody on the board is missing a name column', board.every((r) => 'display_name' in r && !('email' in r)));
  await expectError('a date far from today is refused',
    () => db.query(`select * from public.leaderboard_for_me(current_date - 30)`), 'leaderboard_date_out_of_range');
});
await as(ids.c5, async () => {
  const alone = await rows(`select * from public.leaderboard_for_me(current_date)`);
  check('a user with no friends sees only themselves', alone.length === 1 && alone[0].is_me);
});

console.log('\nsubscriptions and feedback');
await as(ids.ravi, async () => {
  await expectError('a user cannot write a subscription',
    () => db.query(`update public.profiles set subscription_status = 'active' where id = $1`, [ids.ravi]), 'permission denied');
  await expectError('a user cannot call apply_subscription',
    () => db.query(`select public.apply_subscription($1, 'active', 'pro', 'play_store', null)`, [ids.ravi]), 'permission denied');
  await db.query(`insert into public.feedback (topic, message) values ('idea', 'more mascots')`);
  check('a user can send feedback', true);
  await expectError('feedback cannot be sent as someone else',
    () => db.query(`insert into public.feedback (user_id, topic, message) values ($1, 'bug', 'x')`, [ids.anya]), 'permission denied');
  await expectError('feedback cannot be read back from the app',
    () => db.query(`select * from public.feedback`), 'permission denied');
});
const fb = await rows(`select user_id from public.feedback`);
check('feedback is stamped with the sender', fb[0]?.user_id === ids.ravi);

const premiumOf = async (id) => (await rows(`select premium from public.profiles where id = $1`, [id]))[0]?.premium;
await as(null, async () => {
  await db.query(`select public.apply_subscription($1, 'trialing', 'pro_yearly', 'play_store', now() + interval '7 days')`, [ids.dev]);
}, 'service_role');
check('a trial makes the account Pro', (await premiumOf(ids.dev)) === true);
await as(null, async () => {
  await db.query(`select public.apply_subscription($1, 'canceled', 'pro_yearly', 'play_store', now() + interval '2 days')`, [ids.dev]);
}, 'service_role');
check('a cancelled plan stays Pro until it runs out', (await premiumOf(ids.dev)) === true);
await as(null, async () => {
  await db.query(`select public.apply_subscription($1, 'expired', 'pro_yearly', 'play_store', now() - interval '1 day')`, [ids.dev]);
}, 'service_role');
const sub = await rows(`select subscription_status as status, subscription_store as store from public.profiles where id = $1`, [ids.dev]);
check('expiry removes Pro and the profile records why',
  (await premiumOf(ids.dev)) === false && sub[0].status === 'expired' && sub[0].store === 'play_store');
await as(null, async () => {
  await db.query(`select public.apply_subscription($1, 'active', 'pro', 'play_store', null)`, [crypto.randomUUID()]);
}, 'service_role');
check('an id this database does not know is ignored, not raised', true);

console.log('\nonboarding progress');
const phone = crypto.randomUUID();
const record = (step, install = phone) =>
  db.query(`select public.record_onboarding_step($1, $2)`, [install, step]);
const progressOf = async (install = phone) =>
  (await rows(`select * from public.onboarding_progress where install_id = $1`, [install]))[0];
const resume = async (install) => (await rows(`select * from public.onboarding_resume($1)`, [install]))[0];

await as(null, async () => {
  await record('welcome');
  await record('concept');
  await record('permission');
  check('a step is recorded before anyone signs in', true);
  await expectError('a made up step is refused', () => record('lobby'), 'onboarding_step_invalid');
  await expectError('onboarding rows cannot be read directly',
    () => db.query(`select * from public.onboarding_progress`), 'permission denied');
  const back = await resume(phone);
  check('resume returns the furthest step for this install', back?.step === 'permission' && back.completed === false);
  check('an install nobody has seen resumes from nothing', (await resume(crypto.randomUUID())) === undefined);
}, 'anon');

const firstConcept = (await progressOf()).reached_at.concept;
await as(null, () => record('concept'), 'anon');
const wentBack = await progressOf();
check('going back moves the current step but never the furthest',
  wentBack.current_step === 'concept' && wentBack.furthest_step === 'permission');
check('the first time a step was reached is never overwritten', wentBack.reached_at.concept === firstConcept);

await as(ids.anya, () => record('notifications'));
check('signing in links the install to the account', (await progressOf()).user_id === ids.anya);

await as(ids.dev, () => record('welcome'));
check("another account cannot move someone else's progress",
  (await progressOf()).user_id === ids.anya && (await progressOf()).current_step === 'notifications');
await as(null, () => record('welcome'), 'anon');
check('nor can anyone signed out, once it belongs to an account', (await progressOf()).current_step === 'notifications');

const newPhone = crypto.randomUUID();
await as(ids.anya, async () => {
  const carried = await resume(newPhone);
  check('the same account on a new phone resumes where it stopped', carried?.step === 'notifications');
  await record('friends');
  await record('paywall');
  await record('done');
  await record('done');
});
const finished = await progressOf();
check('finishing marks the install complete, once', finished.completed_at !== null && finished.furthest_step === 'done');
await as(ids.anya, async () => {
  await record('welcome');
  const replay = await resume(newPhone);
  check('replaying onboarding afterwards still counts as complete', replay?.completed === true && replay.step === 'done');
});

// A second, anonymous install that quit on the welcome screen.
await as(null, () => record('welcome', crypto.randomUUID()), 'anon');
const funnel = await rows(`select step, reached::int, stopped_here::int from public.onboarding_funnel`);
const at = (step) => funnel.find((row) => row.step === step);
check('the funnel counts every install that reached a step', at('welcome').reached === 2 && at('done').reached === 1);
check('and where they stopped', at('welcome').stopped_here === 1 && at('done').stopped_here === 1,
  JSON.stringify(funnel));
await as(ids.anya, async () => {
  await expectError('the funnel is for the team, not the app',
    () => db.query(`select * from public.onboarding_funnel`), 'permission denied');
});

console.log('\naccount deletion');
await as(ids.ravi, () => record('concept', crypto.randomUUID()));
await db.query(`delete from auth.users where id = $1`, [ids.ravi]);
const ravisProgress = await rows(
  `select user_id from public.onboarding_progress where reached_at ? 'concept' and furthest_step = 'concept' and user_id is null`);
check('onboarding progress survives for the funnel with the account removed from it', ravisProgress.length === 1);
const leftovers = await rows(`
  select
    (select count(*) from public.profiles where id = $1)::int as profiles,
    (select count(*) from public.daily_usage where user_id = $1)::int as usage,
    (select count(*) from public.friendships where user_id = $1 or friend_id = $1)::int as friendships,
    (select count(*) from public.feedback where user_id = $1)::int as feedback`, [ids.ravi]);
check('deleting the auth user removes every row they own, both friendship directions included',
  Object.values(leftovers[0]).every((n) => n === 0), JSON.stringify(leftovers[0]));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
