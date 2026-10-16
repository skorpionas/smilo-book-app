-- Pet first, client optional: pets without an owner, contact cards with only a phone
-- or e-mail, bookings without a client, set_pet_owner.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(16);

\ir fixture.psql

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- contact cards
select lives_ok($$insert into public.clients (phone_e164) values ('+37060000001')$$, 'contact with only a phone');
select lives_ok($$insert into public.clients (email) values ('tik@pastas.lt')$$, 'contact with only an e-mail');
select throws_ok($$insert into public.clients (full_name) values (null)$$, '23514', null, 'empty contact card is rejected');
select throws_ok($$insert into public.clients (full_name) values ('  ')$$, '23514', null, 'blank name alone is rejected');

-- pet without an owner
select lives_ok($$insert into public.pets (id, name, species) values ('d9000000-0000-4000-8000-000000000009', 'Rudis', 'dog')$$,
  'pet without an owner');

-- booking for an owner-less pet, no client at all
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'a0000000-0000-4000-8000-00000000000a',
    -- in the future whenever the test runs: set_pet_owner only moves upcoming bookings
    p_start_at   => date_trunc('day', now() + interval '30 days') + interval '10 hours',
    p_end_at     => date_trunc('day', now() + interval '30 days') + interval '11 hours',
    p_items      => '[{"pet_id":"d9000000-0000-4000-8000-000000000009","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]'
  ), null, 'booking without a client');
select is((select count(*)::int from public.bookings where client_id is null and kind = 'booking'), 1, 'stored with no client');

-- a new pet with no contact at all
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'b0000000-0000-4000-8000-00000000000b',
    p_start_at   => '2026-10-27 10:00 Europe/Vilnius',
    p_end_at     => '2026-10-27 11:00 Europe/Vilnius',
    p_items      => '[{"new_pet":{"name":"Pilkė","species":"cat"},"service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]'
  ), null, 'new pet, no contact');
select is((select client_id from public.pets where name = 'Pilkė'), null::uuid, 'new pet has no owner');

-- a new pet with only a phone
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'a0000000-0000-4000-8000-00000000000a',
    p_start_at   => '2026-10-28 10:00 Europe/Vilnius',
    p_end_at     => '2026-10-28 11:00 Europe/Vilnius',
    p_items      => '[{"new_pet":{"name":"Taška","species":"dog"},"service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]',
    p_new_client => '{"phone_e164":"+37060000002"}'
  ), null, 'new pet with a phone-only contact');
select is(
  (select c.phone_e164 from public.pets p join public.clients c on c.id = p.client_id where p.name = 'Taška'),
  '+37060000002', 'pet linked to the phone-only contact');

-- an existing pet with an owner brings the owner along when no client is passed
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'b0000000-0000-4000-8000-00000000000b',
    p_start_at   => '2026-10-28 10:00 Europe/Vilnius',
    p_end_at     => '2026-10-28 11:00 Europe/Vilnius',
    p_items      => '[{"pet_id":"d1000000-0000-4000-8000-000000000001","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]'
  ), null, 'booking for an owned pet without passing the client');
select is(
  (select b.client_id from public.bookings b join public.booking_items bi on bi.booking_id = b.id
    where bi.pet_id = 'd1000000-0000-4000-8000-000000000001' and b.start_at = '2026-10-28 10:00 Europe/Vilnius'),
  'c1000000-0000-4000-8000-000000000001'::uuid, 'client taken from the pet');

-- an owner-less pet cannot join another client's booking
select throws_ok(
  $$select public.create_booking_with_items(
      p_groomer_id => 'a0000000-0000-4000-8000-00000000000a',
      p_start_at   => '2026-10-29 10:00 Europe/Vilnius',
      p_end_at     => '2026-10-29 11:00 Europe/Vilnius',
      p_client_id  => 'c1000000-0000-4000-8000-000000000001',
      p_items      => '[{"pet_id":"d9000000-0000-4000-8000-000000000009","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]')$$,
  '23514', null, 'owner-less pet in a client''s booking is rejected');

-- set_pet_owner: give Rudis an e-mail-only owner; his upcoming booking follows
select isnt(public.set_pet_owner('d9000000-0000-4000-8000-000000000009', null, '{"email":"rudzio@pastas.lt"}'),
  null::uuid, 'owner added later');
select is(
  (select c.email from public.bookings b join public.clients c on c.id = b.client_id
     join public.booking_items bi on bi.booking_id = b.id
    where bi.pet_id = 'd9000000-0000-4000-8000-000000000009'),
  'rudzio@pastas.lt', 'upcoming booking follows the new owner');

select * from finish();
rollback;
