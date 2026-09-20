-- How big the floating counter is drawn.
--
-- Its own migration rather than an edit to the init, so a database already
-- carrying profiles takes it without being rebuilt. The default is `medium`,
-- which is the size the counter has always been, so nobody's counter changes
-- under them the day this lands.
--
-- The list has to match `CounterSizes` in src/constants/counter.ts, which is
-- what the picker can produce and therefore what the Worker will send.

alter table profiles
  add column if not exists counter_size text not null default 'medium';

alter table profiles
  drop constraint if exists profiles_counter_size_check;

alter table profiles
  add constraint profiles_counter_size_check
  check (counter_size in ('small', 'medium', 'large'));
