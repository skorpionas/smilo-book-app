-- Row level security (issue #7, §14)
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(14);

\ir fixture.psql

insert into public.bookings (id, owner_id, groomer_id, client_id, start_at, end_at)
values ('f0000000-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111',
        'a0000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000001',
        '2026-10-22 10:00 Europe/Vilnius', '2026-10-22 12:00 Europe/Vilnius');
insert into public.booking_items (owner_id, booking_id, pet_id, service_id, duration_min, planned_price)
values ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000010',
        'd1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 120, 40);

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('groomers','clients','pets','services','bookings','booking_items')),
  'RLS is enabled on every app table');

-- anon: no privileges at all
set local role anon;
select throws_ok('select count(*) from public.clients',  '42501', null, 'anon cannot read clients');
select throws_ok('select count(*) from public.bookings', '42501', null, 'anon cannot read bookings');
select throws_ok($$select public.search_directory('maks')$$, '42501', null, 'anon cannot call search_directory');
reset role;

-- second owner: sees nothing of owner 1
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.clients),       0, 'owner 2 sees 0 clients');
select is((select count(*)::int from public.pets),          0, 'owner 2 sees 0 pets');
select is((select count(*)::int from public.bookings),      0, 'owner 2 sees 0 bookings');
select is((select count(*)::int from public.booking_items), 0, 'owner 2 sees 0 booking items');
select throws_ok(
  $$insert into public.pets (client_id, name, species) values ('c1000000-0000-4000-8000-000000000001', 'Svetimas', 'dog')$$,
  '42501', null, 'owner 2 cannot attach a pet to owner 1''s client');
update public.clients set full_name = 'Hacked';
reset role;
select is((select count(*)::int from public.clients where full_name = 'Hacked'), 0,
  'owner 2 cannot update owner 1''s clients');

-- owner 1: sees own data, writes default to own owner_id
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*)::int from public.clients), 2, 'owner 1 sees own 2 clients');
select is((select count(*)::int from public.booking_items), 1, 'owner 1 sees own booking items');
insert into public.clients (full_name) values ('Naujas Klientas');
select is(
  (select owner_id from public.clients where full_name = 'Naujas Klientas'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'owner_id defaults to the logged-in user');
select throws_ok(
  $$insert into public.clients (owner_id, full_name) values ('22222222-2222-4222-8222-222222222222', 'Svetimas')$$,
  '42501', null, 'owner 1 cannot write rows for another owner');
reset role;

select * from finish();
rollback;
