// Runs supabase/migrations against real Postgres (PGlite) and exercises every
// rule the database still owns.
//
// Who may do what is no longer here: the API Worker decides that, and api/test
// is where it is proved. What is left is what only a database can promise, and
// all of it is plain Postgres, which is the point of owning the schema.
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

const rows = async (sql, params) => (await db.query(sql, params)).rows;

for (const file of readdirSync(MIGRATIONS).sort()) {
  await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  console.log(`applied ${file}`);
}

/** Exactly how a real sign in makes an account, which is the only way one is made. */
const signIn = async (sub, email, name = null, avatar = null) =>
  (await rows(`select public.upsert_google_user($1, $2, $3, $4) as id`, [sub, email, name, avatar]))[0].id;

const ids = {};
for (const name of ['ravi', 'anya', 'dev', 'c1', 'c2', 'c3', 'c4', 'c5']) {
  ids[name] = await signIn(
    `google-${name}`,
    `${name}@example.com`,
    name === 'ravi' ? 'Ravi Menon' : null,
    name === 'ravi' ? 'https://g/ravi.png' : null,
  );
}

const today = (await rows(`select current_date::text as d`))[0].d;
const shift = async (days) => (await rows(`select (current_date + $1::int)::text as d`, [days]))[0].d;

console.log('\nprofiles');
const ravi = await rows(`select * from public.profiles where id = $1`, [ids.ravi]);
check('trigger creates a profile on sign up', ravi.length === 1);
check('display name from Google full_name', ravi[0]?.display_name === 'Ravi Menon');
check('avatar falls back to picture', ravi[0]?.avatar_url === 'https://g/ravi.png');
const anya = await rows(`select display_name, email from public.profiles where id = $1`, [ids.anya]);
check('display name falls back to email local part', anya[0]?.display_name === 'anya');
check('the email is kept on the profile, so reading an account is one row', anya[0]?.email === 'anya@example.com');

// Signing in again is the same person, not a second account.
const raviAgain = await signIn('google-ravi', 'ravi@example.com', 'Ravi Menon', 'https://g/ravi-2.png');
check('the same Google account signs in to the same row', raviAgain === ids.ravi);
check('only one user per Google subject',
  (await rows(`select count(*)::int as n from public.users`))[0].n === 8);
const refreshed = await rows(`select avatar_url from public.profiles where id = $1`, [ids.ravi]);
check('a new Google photo is picked up on the next sign in', refreshed[0].avatar_url === 'https://g/ravi-2.png');
await db.query(`update public.profiles set display_name = 'Rav' where id = $1`, [ids.ravi]);
await signIn('google-ravi', 'ravi@example.com', 'Ravi Menon', null);
check('but a name someone chose for themselves is never overwritten',
  (await rows(`select display_name from public.profiles where id = $1`, [ids.ravi]))[0].display_name === 'Rav');

await expectError('premium cannot be written at all, being derived',
  () => db.query(`update public.profiles set premium = true where id = $1`, [ids.ravi]), 'can only be updated to DEFAULT');
await expectError('a bad counter style is rejected',
  () => db.query(`update public.profiles set counter_style = 'neon' where id = $1`, [ids.ravi]), 'violates check');
await expectError('a daily limit outside the allowed range is rejected',
  () => db.query(`update public.profiles set daily_limit = 0 where id = $1`, [ids.ravi]), 'violates check');

console.log('\nincrement_usage');
{
  const yesterday = await shift(-1);
  const batch = [
    { date: today, apps: { instagram: 10, tiktok: 5 } },
    { date: yesterday, apps: { youtube: 3 } },
  ];
  await db.query(`select public.increment_usage($1, $2)`, [ids.ravi, JSON.stringify(batch)]);
  await db.query(`select public.increment_usage($1, $2)`, [ids.ravi, JSON.stringify(batch)]);

  const mine = await rows(
    `select usage_date::text as d, app_key, reels from public.daily_usage where user_id = $1 order by 1, 2`, [ids.ravi]);
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
  await db.query(`select public.increment_usage($1, $2)`, [ids.ravi, JSON.stringify(junk)]);
  const after = await rows(
    `select usage_date::text as d, app_key, reels from public.daily_usage where user_id = $1 order by 1, 2`, [ids.ravi]);
  const tube = after.find((r) => r.d === today && r.app_key === 'youtube');
  check('stale, future, unknown, negative and malformed entries are skipped, not raised',
    after.length === 4 && tube?.reels === 5000, JSON.stringify(after));
  check('an absurd count is clamped to 5000', tube?.reels === 5000);
  await expectError('a payload that is not an array is refused',
    () => db.query(`select public.increment_usage($1, $2)`, [ids.ravi, JSON.stringify({ date: today })]), 'usage_payload_invalid');
  await expectError('a null payload is refused',
    () => db.query(`select public.increment_usage($1, null)`, [ids.ravi]), 'usage_payload_invalid');
  await expectError('a sync with nobody to credit is refused',
    () => db.query(`select public.increment_usage(null, '[]')`), 'not_authenticated');
}

console.log('\nis_premium');
await db.query(`insert into public.daily_usage values ($1, current_date - 20, 'tiktok', 7)`, [ids.ravi]);
const premiumNow = async (id) => (await rows(`select public.is_premium($1) as p`, [id]))[0].p;
check('a free account is not premium', (await premiumNow(ids.ravi)) === false);
await db.query(`update public.profiles set subscription_status = 'active' where id = $1`, [ids.ravi]);
check('an active plan is', (await premiumNow(ids.ravi)) === true);
await db.query(`update public.profiles set subscription_status = 'none' where id = $1`, [ids.ravi]);
check('an account that does not exist is not premium', (await premiumNow(crypto.randomUUID())) === false);

console.log('\ninvites and friendships');
const invite = async (id) => (await rows(`select public.create_invite($1) as code`, [id]))[0].code;
const accept = (id, c) => db.query(`select public.accept_invite($1, $2) as id`, [id, c]);

const code = await invite(ids.ravi);
check('create_invite returns a code', typeof code === 'string' && code.length === 12);
check('a second tap reuses the live code', (await invite(ids.ravi)) === code);
await expectError('accepting your own invite is refused', () => accept(ids.ravi, code), 'invite_own');
await expectError('an invite for nobody is refused', () => invite(null), 'not_authenticated');

{
  const inviter = (await accept(ids.anya, code)).rows[0].id;
  check('accept_invite returns the inviter', inviter === ids.ravi);
  await accept(ids.anya, code);
  const mine = await rows(`select friend_id from public.friendships where user_id = $1`, [ids.anya]);
  check('a second accept is a no-op', mine.length === 1 && mine[0].friend_id === ids.ravi);
  await expectError('an unknown code is refused', () => accept(ids.anya, 'nope'), 'invite_invalid');
}

const both = await rows(`select count(*)::int as n from public.friendships`);
check('both directions are stored', both[0].n === 2);

{
  const shown = await rows(`select * from public.invite_preview($1)`, [code]);
  check('anyone holding a live code sees who sent it', shown.length === 1 && shown[0].name === 'Rav');
  check('and only a name and a photo', Object.keys(shown[0]).sort().join() === 'avatar_url,name');
  check('an unknown code shows nobody', (await rows(`select * from public.invite_preview('ffffffffffff')`)).length === 0);
}
await db.query(`update public.profiles set invite_expires_at = now() - interval '1 minute' where invite_code = $1`, [code]);
check('an expired code shows nobody', (await rows(`select * from public.invite_preview($1)`, [code])).length === 0);
await expectError('an expired code is refused', () => accept(ids.dev, code), 'invite_invalid');
await db.query(`update public.profiles set invite_expires_at = now() + interval '7 days' where invite_code = $1`, [code]);

console.log('\nfriend cap');
for (const name of ['dev', 'c1', 'c2', 'c3']) {
  await accept(ids[name], code);
}
const count = await rows(`select count(*)::int as n from public.friendships where user_id = $1`, [ids.ravi]);
check('a free user fills five seats', count[0].n === 5);
await expectError('the sixth is refused while the inviter is free',
  () => accept(ids.c4, code), 'friend_cap_inviter');
await db.query(`update public.profiles set subscription_status = 'active' where id = $1`, [ids.ravi]);
await accept(ids.c4, code);
check('Pro lifts the cap', true);

console.log('\nleaderboard');
await db.query(`select public.increment_usage($1, $2)`,
  [ids.anya, JSON.stringify([{ date: today, apps: { tiktok: 2 } }])]);
{
  const board = await rows(`select * from public.leaderboard_for_me($1, $2::date)`, [ids.ravi, today]);
  const me = board.find((r) => r.is_me);
  check('the board holds you and every friend', board.length === 7, `(got ${board.length})`);
  check('your own total sums every app', me?.reels === 5000 + 20 + 10, `(got ${me?.reels})`);
  check('fewest reels ranks first', board[0].reels <= board[board.length - 1].reels);
  check('nobody on the board is missing a name column', board.every((r) => 'display_name' in r && !('email' in r)));
  await expectError('a date far from today is refused',
    () => db.query(`select * from public.leaderboard_for_me($1, current_date - 30)`, [ids.ravi]),
    'leaderboard_date_out_of_range');
  await expectError('a board for nobody is refused',
    () => db.query(`select * from public.leaderboard_for_me(null, current_date)`), 'not_authenticated');
}
{
  const alone = await rows(`select * from public.leaderboard_for_me($1, current_date)`, [ids.c5]);
  check('a user with no friends sees only themselves', alone.length === 1 && alone[0].is_me);
}

console.log('\nsubscriptions and feedback');
await db.query(`insert into public.feedback (user_id, topic, message) values ($1, 'idea', 'more mascots')`, [ids.ravi]);
const fb = await rows(`select user_id from public.feedback`);
check('feedback is stamped with the sender the Worker named', fb[0]?.user_id === ids.ravi);
await expectError('feedback with no sender is refused',
  () => db.query(`insert into public.feedback (topic, message) values ('bug', 'x')`), 'not-null');
await expectError('an unknown topic is refused',
  () => db.query(`insert into public.feedback (user_id, topic, message) values ($1, 'rant', 'x')`, [ids.ravi]),
  'violates check');

const premiumOf = async (id) => (await rows(`select premium from public.profiles where id = $1`, [id]))[0]?.premium;
const applySub = (id, status, expires) =>
  db.query(`select public.apply_subscription($1, $2, 'pro_yearly', 'play_store', $3)`, [id, status, expires]);
await applySub(ids.dev, 'trialing', new Date(Date.now() + 7 * 86400000).toISOString());
check('a trial makes the account Pro', (await premiumOf(ids.dev)) === true);
await applySub(ids.dev, 'canceled', new Date(Date.now() + 2 * 86400000).toISOString());
check('a cancelled plan stays Pro until it runs out', (await premiumOf(ids.dev)) === true);
await applySub(ids.dev, 'expired', new Date(Date.now() - 86400000).toISOString());
const sub = await rows(`select subscription_status as status, subscription_store as store from public.profiles where id = $1`, [ids.dev]);
check('expiry removes Pro and the profile records why',
  (await premiumOf(ids.dev)) === false && sub[0].status === 'expired' && sub[0].store === 'play_store');
await applySub(crypto.randomUUID(), 'active', null);
check('an id this database does not know is ignored, not raised', true);

console.log('\nonboarding progress');
const phone = crypto.randomUUID();
const record = (step, install = phone, user = null) =>
  db.query(`select public.record_onboarding_step($1, $2, $3)`, [user, install, step]);
const progressOf = async (install = phone) =>
  (await rows(`select * from public.onboarding_progress where install_id = $1`, [install]))[0];
const resume = async (install, user = null) =>
  (await rows(`select * from public.onboarding_resume($1, $2)`, [user, install]))[0];

await record('welcome');
await record('concept');
await record('permission');
check('a step is recorded before anyone signs in', true);
await expectError('a made up step is refused', () => record('lobby'), 'onboarding_step_invalid');
{
  const back = await resume(phone);
  check('resume returns the furthest step for this install', back?.step === 'permission' && back.completed === false);
  check('an install nobody has seen resumes from nothing', (await resume(crypto.randomUUID())) === undefined);
}

const firstConcept = (await progressOf()).reached_at.concept;
await record('concept');
const wentBack = await progressOf();
check('going back moves the current step but never the furthest',
  wentBack.current_step === 'concept' && wentBack.furthest_step === 'permission');
check('the first time a step was reached is never overwritten', wentBack.reached_at.concept === firstConcept);

await record('notifications', phone, ids.anya);
check('signing in links the install to the account', (await progressOf()).user_id === ids.anya);

await record('welcome', phone, ids.dev);
check("another account cannot move someone else's progress",
  (await progressOf()).user_id === ids.anya && (await progressOf()).current_step === 'notifications');
await record('welcome');
check('nor can anyone signed out, once it belongs to an account', (await progressOf()).current_step === 'notifications');

const newPhone = crypto.randomUUID();
{
  const carried = await resume(newPhone, ids.anya);
  check('the same account on a new phone resumes where it stopped', carried?.step === 'notifications');
  await record('friends', phone, ids.anya);
  await record('paywall', phone, ids.anya);
  await record('done', phone, ids.anya);
  await record('done', phone, ids.anya);
}
const finished = await progressOf();
check('finishing marks the install complete, once', finished.completed_at !== null && finished.furthest_step === 'done');
{
  await record('welcome', phone, ids.anya);
  const replay = await resume(newPhone, ids.anya);
  check('replaying onboarding afterwards still counts as complete', replay?.completed === true && replay.step === 'done');
}

// A second, anonymous install that quit on the welcome screen.
await record('welcome', crypto.randomUUID());
const funnel = await rows(`select step, reached::int, stopped_here::int from public.onboarding_funnel`);
const at = (step) => funnel.find((row) => row.step === step);
check('the funnel counts every install that reached a step', at('welcome').reached === 2 && at('done').reached === 1);
check('and where they stopped', at('welcome').stopped_here === 1 && at('done').stopped_here === 1,
  JSON.stringify(funnel));
console.log('\naccount deletion');
await record('concept', crypto.randomUUID(), ids.ravi);
await db.query(`delete from public.users where id = $1`, [ids.ravi]);
const ravisProgress = await rows(
  `select user_id from public.onboarding_progress where reached_at ? 'concept' and furthest_step = 'concept' and user_id is null`);
check('onboarding progress survives for the funnel with the account removed from it', ravisProgress.length === 1);
const leftovers = await rows(`
  select
    (select count(*) from public.profiles where id = $1)::int as profiles,
    (select count(*) from public.daily_usage where user_id = $1)::int as usage,
    (select count(*) from public.friendships where user_id = $1 or friend_id = $1)::int as friendships,
    (select count(*) from public.feedback where user_id = $1)::int as feedback`, [ids.ravi]);
check('deleting the user removes every row they own, both friendship directions included',
  Object.values(leftovers[0]).every((n) => n === 0), JSON.stringify(leftovers[0]));
check('and every session they had left open',
  (await rows(`select 1 from public.refresh_tokens where user_id = $1`, [ids.ravi])).length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
