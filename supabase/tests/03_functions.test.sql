-- RPC functions: create_booking_with_items, get_price_prefill, search_directory, anonymize_client
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(17);

\ir fixture.psql

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- create_booking_with_items: new client + new pet in one call (US-06)
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'a0000000-0000-4000-8000-00000000000a',
    p_start_at   => '2026-10-23 10:00 Europe/Vilnius',
    p_end_at     => '2026-10-23 12:00 Europe/Vilnius',
    p_items      => '[{"new_pet":{"name":"Bimas","species":"dog","breed":"Pudelis"},
                       "service_id":"e1000000-0000-4000-8000-000000000001","duration_min":120,"planned_price":45}]',
    p_new_client => '{"full_name":"Ona Jonaitienė","phone_e164":"+37061111111"}'
  ), null, 'creates client + pet + booking in one call');
select is((select count(*)::int from public.clients where full_name = 'Ona Jonaitienė'), 1, 'new client exists');
select is((select count(*)::int from public.pets where name = 'Bimas'), 1, 'new pet exists');
select is(
  (select bi.planned_price from public.booking_items bi join public.pets p on p.id = bi.pet_id where p.name = 'Bimas'),
  45.00::numeric, 'item stored with planned price');

-- two pets of the same client in one booking (US-07)
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'b0000000-0000-4000-8000-00000000000b',
    p_start_at   => '2026-10-23 10:00 Europe/Vilnius',
    p_end_at     => '2026-10-23 13:00 Europe/Vilnius',
    p_client_id  => 'c1000000-0000-4000-8000-000000000001',
    p_items      => '[{"pet_id":"d1000000-0000-4000-8000-000000000001","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":120,"planned_price":40},
                      {"pet_id":"d2000000-0000-4000-8000-000000000002","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":25}]'
  ), null, 'multi-pet booking for an existing client');

-- all-or-nothing: overlap rolls back the new client too
select throws_ok(
  $$select public.create_booking_with_items(
      p_groomer_id => 'a0000000-0000-4000-8000-00000000000a',
      p_start_at   => '2026-10-23 11:00 Europe/Vilnius',
      p_end_at     => '2026-10-23 12:00 Europe/Vilnius',
      p_items      => '[{"new_pet":{"name":"Pilkis","species":"cat"},"service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]',
      p_new_client => '{"full_name":"Turi Nebūti"}')$$,
  '23P01', null, 'overlap raises 23P01');
select is((select count(*)::int from public.clients where full_name = 'Turi Nebūti'), 0, 'failed call leaves no client behind');
select is((select count(*)::int from public.pets where name = 'Pilkis'), 0, 'failed call leaves no pet behind');

select throws_ok(
  $$select public.create_booking_with_items(
      p_groomer_id => 'a0000000-0000-4000-8000-00000000000a',
      p_start_at   => '2026-10-24 10:00 Europe/Vilnius',
      p_end_at     => '2026-10-24 11:00 Europe/Vilnius',
      p_client_id  => 'c1000000-0000-4000-8000-000000000001',
      p_items      => '[]')$$,
  '22023', null, 'empty item list is rejected');

-- price prefill (US-08)
select is(public.get_price_prefill('d3000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001'),
          40.00::numeric, 'no history → service default price');
reset role;
-- a completed past visit for Reksas at 47 €
insert into public.bookings (id, owner_id, groomer_id, client_id, start_at, end_at, status)
values ('f0000000-0000-4000-8000-000000000020', '11111111-1111-4111-8111-111111111111',
        'a0000000-0000-4000-8000-00000000000a', 'c2000000-0000-4000-8000-000000000002',
        '2026-09-01 10:00 Europe/Vilnius', '2026-09-01 12:00 Europe/Vilnius', 'completed');
insert into public.booking_items (owner_id, booking_id, pet_id, service_id, duration_min, planned_price, actual_price)
values ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000020',
        'd3000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001', 120, 40, 47);
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.get_price_prefill('d3000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001'),
          47.00::numeric, 'last completed visit price wins');

-- search (US-14)
select ok(exists(select 1 from public.search_directory('zuikis') where kind = 'pet' and title = 'Žuikis'),
          'diacritic-insensitive pet search');
select ok(exists(select 1 from public.search_directory('612 34') where kind = 'client' and title = 'Rasa Petrauskienė'),
          'phone search matches partial digits');
select is((select count(*)::int from public.search_directory('%%')), 0, 'LIKE wildcards in input match nothing');

-- anonymize (US-17)
select throws_ok($$select public.anonymize_client('c1000000-0000-4000-8000-000000000001')$$,
                 'P0001', null, 'blocked while the client has future bookings');
update public.bookings set status = 'cancelled' where client_id = 'c1000000-0000-4000-8000-000000000001';
select lives_ok($$select public.anonymize_client('c1000000-0000-4000-8000-000000000001')$$, 'anonymises after cancelling');
select ok(
  (select full_name = 'Anonimizuotas klientas' and phone_e164 is null and anonymized_at is not null
   from public.clients where id = 'c1000000-0000-4000-8000-000000000001')
  and (select count(*) from public.bookings where client_id = 'c1000000-0000-4000-8000-000000000001') = 1,
  'personal fields cleared, visit records kept');
reset role;

select * from finish();
rollback;
