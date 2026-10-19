-- update_booking_with_items: change a visit's services (service, price, single <-> family).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(18);

\ir fixture.psql

insert into public.services (id, owner_id, name, default_duration_min, default_price) values
  ('e2000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Maudymas', 60, 25.00);

insert into public.bookings (id, owner_id, kind, groomer_id, client_id, start_at, end_at, status) values
  -- in three days, 08:00–10:00 UTC: Maksas, full cut
  ('f5000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'booking',
   'a0000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000001',
   date_trunc('day', now()) + interval '3 days 8 hours',
   date_trunc('day', now()) + interval '3 days 10 hours', 'scheduled'),
  -- same day, same groomer, 11:00–12:00
  ('f6000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'booking',
   'a0000000-0000-4000-8000-00000000000a', 'c2000000-0000-4000-8000-000000000002',
   date_trunc('day', now()) + interval '3 days 11 hours',
   date_trunc('day', now()) + interval '3 days 12 hours', 'scheduled'),
  -- completed two days ago, with a visit note
  ('f7000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'booking',
   'b0000000-0000-4000-8000-00000000000b', 'c1000000-0000-4000-8000-000000000001',
   date_trunc('day', now()) - interval '2 days' + interval '8 hours',
   date_trunc('day', now()) - interval '2 days' + interval '10 hours', 'completed'),
  -- no-show: not editable
  ('f8000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'booking',
   'b0000000-0000-4000-8000-00000000000b', 'c2000000-0000-4000-8000-000000000002',
   date_trunc('day', now()) - interval '3 days' + interval '8 hours',
   date_trunc('day', now()) - interval '3 days' + interval '9 hours', 'no_show');

insert into public.booking_items (owner_id, booking_id, pet_id, service_id, duration_min, planned_price, actual_price, visit_notes, position) values
  ('11111111-1111-4111-8111-111111111111', 'f5000000-0000-4000-8000-000000000005',
   'd1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 120, 40, null, '', 1),
  ('11111111-1111-4111-8111-111111111111', 'f6000000-0000-4000-8000-000000000006',
   'd3000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001', 60, 30, null, '', 1),
  ('11111111-1111-4111-8111-111111111111', 'f7000000-0000-4000-8000-000000000007',
   'd1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 120, 40, 40, 'Kailis susivėlęs', 1),
  ('11111111-1111-4111-8111-111111111111', 'f8000000-0000-4000-8000-000000000008',
   'd3000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001', 60, 30, null, '', 1);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- 1. Service A -> service B, another price, shorter
select lives_ok($$
  select public.update_booking_with_items(
    'f5000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-00000000000a',
    date_trunc('day', now()) + interval '3 days 8 hours', date_trunc('day', now()) + interval '3 days 9 hours',
    '[{"pet_id":"d1000000-0000-4000-8000-000000000001","service_id":"e2000000-0000-4000-8000-000000000002","duration_min":60,"planned_price":27.5}]',
    'Tik maudymas')
$$, 'change the service and price of a scheduled visit');
select is((select service_id from public.booking_items where booking_id = 'f5000000-0000-4000-8000-000000000005'),
  'e2000000-0000-4000-8000-000000000002'::uuid, 'service replaced');
select is((select planned_price from public.booking_items where booking_id = 'f5000000-0000-4000-8000-000000000005'),
  27.50::numeric, 'new planned price');
select is((select actual_price from public.booking_items where booking_id = 'f5000000-0000-4000-8000-000000000005'),
  null, 'scheduled visit has no actual price');
select is((select end_at - start_at from public.bookings where id = 'f5000000-0000-4000-8000-000000000005'),
  interval '1 hour', 'end time follows the new duration');
select is((select notes from public.bookings where id = 'f5000000-0000-4000-8000-000000000005'),
  'Tik maudymas', 'booking notes saved');

-- 2. Single -> family: one shared service for both pets
select lives_ok($$
  select public.update_booking_with_items(
    'f5000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-00000000000a',
    date_trunc('day', now()) + interval '3 days 8 hours', date_trunc('day', now()) + interval '3 days 10 hours',
    '[{"pet_id":"d1000000-0000-4000-8000-000000000001","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":35,"shared_group":1},
      {"pet_id":"d2000000-0000-4000-8000-000000000002","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":35,"shared_group":1}]')
$$, 'single visit becomes a shared family service');
select is((select count(*)::int from public.booking_items where booking_id = 'f5000000-0000-4000-8000-000000000005' and shared_group = 1),
  2, 'two rows in one shared group');
select is((select sum(planned_price) from public.booking_items where booking_id = 'f5000000-0000-4000-8000-000000000005'),
  70.00::numeric, 'family total stored split per pet');

-- 3. Family -> single
select lives_ok($$
  select public.update_booking_with_items(
    'f5000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-00000000000a',
    date_trunc('day', now()) + interval '3 days 8 hours', date_trunc('day', now()) + interval '3 days 10 hours',
    '[{"pet_id":"d2000000-0000-4000-8000-000000000002","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":120,"planned_price":45,"remember":true}]')
$$, 'family visit back to one pet');
select is((select count(*)::int from public.booking_items where booking_id = 'f5000000-0000-4000-8000-000000000005'),
  1, 'one row left');
select is((select price from public.pet_services
            where pet_id = 'd2000000-0000-4000-8000-000000000002' and service_id = 'e1000000-0000-4000-8000-000000000001'),
  45.00::numeric, '"remember" saves the pet''s own price');

-- 4. Longer than the free time -> overlap, nothing changed
select throws_ok($$
  select public.update_booking_with_items(
    'f5000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-00000000000a',
    date_trunc('day', now()) + interval '3 days 8 hours', date_trunc('day', now()) + interval '3 days 11 hours 30 minutes',
    '[{"pet_id":"d2000000-0000-4000-8000-000000000002","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":210,"planned_price":60}]')
$$, '23P01', null, 'a longer visit cannot overlap the next booking');

-- 5. Completed visit: prices become actual prices, visit notes kept
select lives_ok($$
  select public.update_booking_with_items(
    'f7000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-00000000000b',
    date_trunc('day', now()) - interval '2 days' + interval '8 hours',
    date_trunc('day', now()) - interval '2 days' + interval '9 hours',
    '[{"pet_id":"d1000000-0000-4000-8000-000000000001","service_id":"e2000000-0000-4000-8000-000000000002","duration_min":60,"planned_price":25}]')
$$, 'correct the service of a completed visit');
select is((select actual_price from public.booking_items where booking_id = 'f7000000-0000-4000-8000-000000000007'),
  25.00::numeric, 'completed visit: actual price = new price');
select is((select visit_notes from public.booking_items where booking_id = 'f7000000-0000-4000-8000-000000000007'),
  'Kailis susivėlęs', 'visit notes kept for the pet');

-- 6. Not editable
select throws_ok($$
  select public.update_booking_with_items(
    'f8000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-00000000000b',
    date_trunc('day', now()) - interval '3 days' + interval '8 hours',
    date_trunc('day', now()) - interval '3 days' + interval '9 hours',
    '[{"pet_id":"d3000000-0000-4000-8000-000000000003","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]')
$$, 'P0002', null, 'a no-show cannot be changed');

-- 7. Another owner cannot touch it
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok($$
  select public.update_booking_with_items(
    'f6000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-00000000000a',
    date_trunc('day', now()) + interval '3 days 11 hours', date_trunc('day', now()) + interval '3 days 12 hours',
    '[{"pet_id":"d3000000-0000-4000-8000-000000000003","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":1}]')
$$, 'P0002', null, 'another owner''s booking is invisible');

select * from finish();
rollback;
