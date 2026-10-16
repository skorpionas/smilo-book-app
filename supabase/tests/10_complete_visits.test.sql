-- Visits complete themselves after their end time; complete_visit() sets / corrects the result (US-11).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(19);

\ir fixture.psql

-- Times relative to now, on the 15-min grid (whole days in UTC).
insert into public.bookings (id, owner_id, kind, groomer_id, client_id, start_at, end_at, status) values
  -- ended two days ago
  ('f1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'booking',
   'a0000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000001',
   date_trunc('day', now()) - interval '2 days' + interval '8 hours',
   date_trunc('day', now()) - interval '2 days' + interval '10 hours', 'scheduled'),
  -- in three days
  ('f2000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'booking',
   'a0000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000001',
   date_trunc('day', now()) + interval '3 days' + interval '8 hours',
   date_trunc('day', now()) + interval '3 days' + interval '10 hours', 'scheduled'),
  -- cancelled in the past: stays cancelled
  ('f3000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'booking',
   'b0000000-0000-4000-8000-00000000000b', 'c2000000-0000-4000-8000-000000000002',
   date_trunc('day', now()) - interval '2 days' + interval '8 hours',
   date_trunc('day', now()) - interval '2 days' + interval '10 hours', 'cancelled');

-- blocked time in the past: never "completed"
insert into public.bookings (id, owner_id, kind, groomer_id, start_at, end_at, block_reason) values
  ('f4000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'block',
   'b0000000-0000-4000-8000-00000000000b',
   date_trunc('day', now()) - interval '1 day' + interval '8 hours',
   date_trunc('day', now()) - interval '1 day' + interval '9 hours', 'Pietūs');

insert into public.booking_items (id, owner_id, booking_id, pet_id, service_id, duration_min, planned_price, position) values
  ('91000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'f1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 60, 30, 0),
  ('92000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'f1000000-0000-4000-8000-000000000001',
   'd2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 60, 20, 1),
  ('93000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'f2000000-0000-4000-8000-000000000002',
   'd1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 120, 40, 0);

-- ---------------------------------------------------------------------------
-- Auto-complete
-- ---------------------------------------------------------------------------
-- (≥ 1: seed visits may also have ended since `supabase start`)
select ok(public.complete_past_bookings() >= 1, 'visits that are over get completed');
select is((select status::text from public.bookings where id = 'f1000000-0000-4000-8000-000000000001'),
  'completed', 'past scheduled visit -> completed');
select isnt((select completed_at from public.bookings where id = 'f1000000-0000-4000-8000-000000000001'),
  null, 'completed_at is set');
select is((select sum(actual_price) from public.booking_items where booking_id = 'f1000000-0000-4000-8000-000000000001'),
  50.00::numeric, 'actual price = planned price');
select is((select status::text from public.bookings where id = 'f2000000-0000-4000-8000-000000000002'),
  'scheduled', 'future visit stays scheduled');
select is((select status::text from public.bookings where id = 'f3000000-0000-4000-8000-000000000003'),
  'cancelled', 'cancelled visit stays cancelled');
select is((select status::text from public.bookings where id = 'f4000000-0000-4000-8000-000000000004'),
  'scheduled', 'blocked time is left alone');
select is(public.complete_past_bookings(), 0, 'running again changes nothing');

create function pg_temp.cron_job_ok() returns boolean language plpgsql as $$
begin
  if to_regclass('cron.job') is null then
    return not exists (select 1 from pg_available_extensions where name = 'pg_cron');
  end if;
  return exists (select 1 from cron.job
                  where jobname = 'complete-past-bookings' and schedule = '*/15 * * * *' and active);
end;
$$;
select ok(pg_temp.cron_job_ok(), 'pg_cron runs complete_past_bookings every 15 minutes');

-- ---------------------------------------------------------------------------
-- complete_visit as the owner
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select throws_ok(
  $$select public.complete_past_bookings()$$, '42501', null,
  'the app cannot run the auto-complete job itself');

-- it was really a no-show
select lives_ok(
  $$select public.complete_visit('f1000000-0000-4000-8000-000000000001', 'no_show',
      '[{"id":"91000000-0000-4000-8000-000000000001","visit_notes":"Neatėjo, neskambino"}]')$$,
  'owner marks an auto-completed visit as no-show');
select is((select status::text from public.bookings where id = 'f1000000-0000-4000-8000-000000000001'),
  'no_show', 'status -> no_show');
select is((select count(*)::int from public.booking_items
            where booking_id = 'f1000000-0000-4000-8000-000000000001' and actual_price is not null),
  0, 'no-show has no actual price');
select is((select visit_notes from public.booking_items where id = '91000000-0000-4000-8000-000000000001'),
  'Neatėjo, neskambino', 'visit notes saved');

-- corrected back to done, with a different price for one pet
select lives_ok(
  $$select public.complete_visit('f1000000-0000-4000-8000-000000000001', 'completed',
      '[{"id":"91000000-0000-4000-8000-000000000001","actual_price":35,"visit_notes":"Kailis susivėlęs"},
        {"id":"92000000-0000-4000-8000-000000000002","actual_price":null}]')$$,
  'owner records the visit as done');
select is(
  (select array_agg(actual_price order by position) from public.booking_items
    where booking_id = 'f1000000-0000-4000-8000-000000000001'),
  array[35.00, 20.00]::numeric[], 'own price kept, missing price = planned');

select throws_ok(
  $$select public.complete_visit('f2000000-0000-4000-8000-000000000002', 'completed', '[]')$$,
  '22008', null, 'a visit on a later day cannot be completed yet');
select throws_ok(
  $$select public.complete_visit('f3000000-0000-4000-8000-000000000003', 'completed', '[]')$$,
  'P0002', null, 'a cancelled visit cannot be completed');

-- another owner cannot see or complete it
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok(
  $$select public.complete_visit('f1000000-0000-4000-8000-000000000001', 'no_show', '[]')$$,
  'P0002', null, 'another owner cannot complete the visit');

select * from finish();
rollback;
