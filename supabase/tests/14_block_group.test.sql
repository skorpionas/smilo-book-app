-- Blocked time over several days: rows linked by block_group.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(7);

\ir fixture.psql

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- 1. A three-day vacation for groomer A, saved together (05:00–16:00 UTC = 08:00–19:00 in Vilnius)
select lives_ok($$
  insert into public.bookings (kind, groomer_id, start_at, end_at, block_reason, block_group)
  select 'block', 'a0000000-0000-4000-8000-00000000000a',
         date_trunc('day', now()) + make_interval(days => d, hours => 5),
         date_trunc('day', now()) + make_interval(days => d, hours => 16),
         'Atostogos', 'f1400000-0000-4000-8000-0000000000aa'
  from generate_series(20, 22) d
$$, 'blocked time over several days is saved with one group');

select is(
  (select count(*)::int from public.bookings where block_group = 'f1400000-0000-4000-8000-0000000000aa'),
  3, 'one row per day');

-- 2. Only blocked time can carry a group
select throws_ok($$
  insert into public.bookings (kind, groomer_id, client_id, start_at, end_at, block_group)
  values ('booking', 'b0000000-0000-4000-8000-00000000000b', 'c1000000-0000-4000-8000-000000000001',
          date_trunc('day', now()) + interval '30 days 8 hours',
          date_trunc('day', now()) + interval '30 days 9 hours',
          'f1400000-0000-4000-8000-0000000000bb')
$$, '23514', null, 'a visit cannot have a block group');

-- 3. A visit on a day of the period still fails (same exclusion constraint)
select throws_ok($$
  insert into public.bookings (kind, groomer_id, client_id, start_at, end_at)
  values ('booking', 'a0000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000001',
          date_trunc('day', now()) + interval '21 days 8 hours',
          date_trunc('day', now()) + interval '21 days 9 hours')
$$, '23P01', null, 'visit on a vacation day is rejected');

-- 4. Another owner sees nothing of the group
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(
  (select count(*)::int from public.bookings where block_group = 'f1400000-0000-4000-8000-0000000000aa'),
  0, 'other owner sees no rows of the group');
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- 5. Deleting by group removes the whole period
select lives_ok($$
  delete from public.bookings
  where block_group = 'f1400000-0000-4000-8000-0000000000aa' and kind = 'block' and status = 'scheduled'
$$, 'whole period deleted by group');
select is(
  (select count(*)::int from public.bookings where block_group = 'f1400000-0000-4000-8000-0000000000aa'),
  0, 'no rows of the group left');

select * from finish();
rollback;
