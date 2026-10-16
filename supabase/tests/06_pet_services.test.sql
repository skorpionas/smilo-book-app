-- Per-pet services (custom duration + price), "remember" in create_booking_with_items,
-- pre-fill order, RLS, and the anon function surface.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(14);

\ir fixture.psql

insert into public.services (id, owner_id, name, default_duration_min, default_price) values
  ('e2000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Maudymas', 60, 20.00);
-- a service of owner 2, to prove cross-owner references are refused
insert into public.services (id, owner_id, name, default_duration_min, default_price) values
  ('e9000000-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222', 'Svetima', 60, 10.00);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- custom price wins over the default
insert into public.pet_services (pet_id, service_id, duration_min, price)
values ('d1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 150, 55.00);
select is(public.get_price_prefill('d1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001'),
  55.00::numeric, 'pet custom price is the pre-fill');
select is(public.get_price_prefill('d2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001'),
  40.00::numeric, 'other pet of the same client keeps the default');

select throws_ok(
  $$insert into public.pet_services (pet_id, service_id, duration_min, price)
    values ('d1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 60, 10)$$,
  '23505', null, 'one row per pet + service');
select throws_ok(
  $$insert into public.pet_services (pet_id, service_id, duration_min, price)
    values ('d1000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002', 50, 10)$$,
  '23514', null, 'duration must be on the 15-min grid');
select throws_ok(
  $$insert into public.pet_services (pet_id, service_id, duration_min, price)
    values ('d1000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000009', 60, 10)$$,
  '42501', null, 'cannot attach another owner''s service');

-- "remember": saves the item for an existing pet and for a pet created in the booking
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'a0000000-0000-4000-8000-00000000000a',
    p_start_at   => '2026-10-27 10:00 Europe/Vilnius',
    p_end_at     => '2026-10-27 12:00 Europe/Vilnius',
    p_client_id  => 'c1000000-0000-4000-8000-000000000001',
    p_items      => '[{"pet_id":"d2000000-0000-4000-8000-000000000002","service_id":"e2000000-0000-4000-8000-000000000002","duration_min":45,"planned_price":18,"remember":true},
                      {"new_pet":{"name":"Pūkas","species":"cat"},"service_id":"e2000000-0000-4000-8000-000000000002","duration_min":75,"planned_price":22,"remember":true}]'
  ), null, 'booking with remembered items');
select is((select price from public.pet_services where pet_id = 'd2000000-0000-4000-8000-000000000002'),
  18.00::numeric, 'existing pet: remembered price');
select is(
  (select ps.duration_min from public.pet_services ps join public.pets p on p.id = ps.pet_id where p.name = 'Pūkas'),
  75, 'new pet: remembered duration');

-- remember again updates instead of failing
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'b0000000-0000-4000-8000-00000000000b',
    p_start_at   => '2026-10-28 10:00 Europe/Vilnius',
    p_end_at     => '2026-10-28 11:00 Europe/Vilnius',
    p_client_id  => 'c1000000-0000-4000-8000-000000000001',
    p_items      => '[{"pet_id":"d2000000-0000-4000-8000-000000000002","service_id":"e2000000-0000-4000-8000-000000000002","duration_min":60,"planned_price":19,"remember":true}]'
  ), null, 'second remembered booking');
select is((select price from public.pet_services where pet_id = 'd2000000-0000-4000-8000-000000000002'),
  19.00::numeric, 'remember updates the existing row');

-- without "remember" nothing is stored
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'a0000000-0000-4000-8000-00000000000a',
    p_start_at   => '2026-10-29 10:00 Europe/Vilnius',
    p_end_at     => '2026-10-29 11:00 Europe/Vilnius',
    p_client_id  => 'c2000000-0000-4000-8000-000000000002',
    p_items      => '[{"pet_id":"d3000000-0000-4000-8000-000000000003","service_id":"e2000000-0000-4000-8000-000000000002","duration_min":60,"planned_price":30}]'
  ), null, 'plain booking');
select is((select count(*)::int from public.pet_services where pet_id = 'd3000000-0000-4000-8000-000000000003'),
  0, 'no remember, no custom row');

-- second owner sees none of it
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.pet_services), 0, 'second owner sees no pet services');

-- anon: no table access, no callable functions at all
reset role;
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon can execute no function in public');

select * from finish();
rollback;
