-- One service for several pets: shared_group on items, client_services with RLS.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(7);

\ir fixture.psql

insert into public.services (id, owner_id, name, default_duration_min, default_price) values
  ('e9000000-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222', 'Svetima', 60, 10.00);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- shared service for Maksas + Žuikis: 2 h, 50 € split 1 h + 1 h, 25 + 25
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'a0000000-0000-4000-8000-00000000000a',
    p_start_at   => '2026-10-27 10:00 Europe/Vilnius',
    p_end_at     => '2026-10-27 12:00 Europe/Vilnius',
    p_client_id  => 'c1000000-0000-4000-8000-000000000001',
    p_items      => '[{"pet_id":"d1000000-0000-4000-8000-000000000001","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":25,"shared_group":1},
                      {"pet_id":"d2000000-0000-4000-8000-000000000002","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":25,"shared_group":1}]'
  ), null, 'booking with one shared service');
select is((select count(*)::int from public.booking_items where shared_group = 1), 2, 'both rows carry the group');
select is((select sum(planned_price) from public.booking_items where shared_group = 1), 50.00::numeric, 'split adds up');

-- family service
select lives_ok(
  $$insert into public.client_services (client_id, service_id, duration_min, price)
    values ('c1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 120, 50)$$,
  'family service saved');
select throws_ok(
  $$insert into public.client_services (client_id, service_id, duration_min, price)
    values ('c1000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000009', 60, 10)$$,
  '42501', null, 'another owner''s service is refused');

set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.client_services), 0, 'second owner sees no family services');

reset role;
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon can still execute nothing');

select * from finish();
rollback;
