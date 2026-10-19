-- Two visits at the same time for one groomer, only when confirmed (overlap_ok).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);

\ir fixture.psql

insert into public.bookings (id, owner_id, kind, groomer_id, client_id, start_at, end_at, status, block_reason) values
  -- in three days, 08:00–09:00 UTC: Maksas (ordinary visit)
  ('f1300000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'booking',
   'a0000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000001',
   date_trunc('day', now()) + interval '3 days 8 hours',
   date_trunc('day', now()) + interval '3 days 9 hours', 'scheduled', ''),
  -- same day, 12:00–13:00: break
  ('f1300000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'block',
   'a0000000-0000-4000-8000-00000000000a', null,
   date_trunc('day', now()) + interval '3 days 12 hours',
   date_trunc('day', now()) + interval '3 days 13 hours', 'scheduled', 'Pietūs');

insert into public.booking_items (owner_id, booking_id, pet_id, service_id, duration_min, planned_price, position) values
  ('11111111-1111-4111-8111-111111111111', 'f1300000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 60, 40, 1);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- 1. Without confirmation an overlap still fails
select throws_ok($$
  select public.create_booking_with_items(
    'a0000000-0000-4000-8000-00000000000a',
    date_trunc('day', now()) + interval '3 days 8 hours 30 minutes',
    date_trunc('day', now()) + interval '3 days 9 hours 30 minutes',
    '[{"pet_id":"d3000000-0000-4000-8000-000000000003","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]',
    'c2000000-0000-4000-8000-000000000002')
$$, '23P01', null, 'overlap without confirmation fails');

-- 2. Confirmed: a second family at the same time
select lives_ok($$
  select public.create_booking_with_items(
    'a0000000-0000-4000-8000-00000000000a',
    date_trunc('day', now()) + interval '3 days 8 hours 30 minutes',
    date_trunc('day', now()) + interval '3 days 9 hours 30 minutes',
    '[{"pet_id":"d3000000-0000-4000-8000-000000000003","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]',
    'c2000000-0000-4000-8000-000000000002', null, '', true)
$$, 'confirmed overlap is saved');
select is(
  (select b.overlap_ok from public.bookings b join public.booking_items i on i.booking_id = b.id
    where i.pet_id = 'd3000000-0000-4000-8000-000000000003'),
  true, 'the visit is marked overlap_ok');

-- 3. Confirmation never covers blocked time
select throws_ok($$
  select public.create_booking_with_items(
    'a0000000-0000-4000-8000-00000000000a',
    date_trunc('day', now()) + interval '3 days 12 hours',
    date_trunc('day', now()) + interval '3 days 12 hours 30 minutes',
    '[{"pet_id":"d3000000-0000-4000-8000-000000000003","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":30,"planned_price":10}]',
    'c2000000-0000-4000-8000-000000000002', null, '', true)
$$, '23P01', null, 'confirmed visit still cannot overlap blocked time');

-- 4. Blocked time cannot be put on top of a confirmed visit (09:00–09:30 overlaps only Reksas)
select throws_ok($$
  insert into public.bookings (kind, groomer_id, start_at, end_at, block_reason)
  values ('block', 'a0000000-0000-4000-8000-00000000000a',
    date_trunc('day', now()) + interval '3 days 9 hours',
    date_trunc('day', now()) + interval '3 days 9 hours 30 minutes', '')
$$, '23P01', null, 'block over a confirmed visit fails');

-- 5. Moving the ordinary visit while it still overlaps needs confirmation too
select throws_ok($$
  update public.bookings set end_at = date_trunc('day', now()) + interval '3 days 9 hours 15 minutes'
  where id = 'f1300000-0000-4000-8000-000000000001'
$$, '23P01', null, 'moving an ordinary visit onto a confirmed one fails');
select lives_ok($$
  update public.bookings
     set end_at = date_trunc('day', now()) + interval '3 days 9 hours 15 minutes', overlap_ok = true
   where id = 'f1300000-0000-4000-8000-000000000001'
$$, 'moving it with confirmation works');

-- 6. Not moved: notes / status changes are never blocked
select lives_ok($$
  update public.bookings set status = 'no_show'
   where id = 'f1300000-0000-4000-8000-000000000001'
$$, 'status change of an overlapping visit is not blocked');

-- 7. update_booking_with_items: flag cleared → overlap fails; flag kept → saved
select throws_ok($$
  select public.update_booking_with_items(
    (select booking_id from public.booking_items where pet_id = 'd3000000-0000-4000-8000-000000000003'),
    'a0000000-0000-4000-8000-00000000000a',
    date_trunc('day', now()) + interval '3 days 8 hours 15 minutes',
    date_trunc('day', now()) + interval '3 days 9 hours',
    '[{"pet_id":"d3000000-0000-4000-8000-000000000003","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":45,"planned_price":30}]')
$$, '23P01', null, 'changing a visit onto another without confirmation fails');
select lives_ok($$
  select public.update_booking_with_items(
    (select booking_id from public.booking_items where pet_id = 'd3000000-0000-4000-8000-000000000003'),
    'a0000000-0000-4000-8000-00000000000a',
    date_trunc('day', now()) + interval '3 days 8 hours 15 minutes',
    date_trunc('day', now()) + interval '3 days 9 hours',
    '[{"pet_id":"d3000000-0000-4000-8000-000000000003","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":45,"planned_price":30}]',
    '', true)
$$, 'with confirmation it is saved');

-- 8. Two confirmed visits may overlap each other (a third pet)
select lives_ok($$
  select public.create_booking_with_items(
    'a0000000-0000-4000-8000-00000000000a',
    date_trunc('day', now()) + interval '3 days 8 hours 30 minutes',
    date_trunc('day', now()) + interval '3 days 8 hours 45 minutes',
    '[{"pet_id":"d2000000-0000-4000-8000-000000000002","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":15,"planned_price":10}]',
    'c1000000-0000-4000-8000-000000000001', null, '', true)
$$, 'three visits at once when each is confirmed');

-- 9. Only visits carry the flag
select throws_ok($$
  insert into public.bookings (kind, groomer_id, start_at, end_at, block_reason, overlap_ok)
  values ('block', 'b0000000-0000-4000-8000-00000000000b',
    date_trunc('day', now()) + interval '4 days 9 hours',
    date_trunc('day', now()) + interval '4 days 10 hours', '', true)
$$, '23514', null, 'blocked time cannot be overlap_ok');

select * from finish();
rollback;
