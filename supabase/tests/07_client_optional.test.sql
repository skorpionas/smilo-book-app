-- Family (account) is the root: every pet belongs to one; the family's contact is
-- optional; a family without contact is shown by its pets; moving a pet between
-- families; bookings for brand-new pets.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(16);

\ir fixture.psql

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- families: contact optional
select lives_ok($$insert into public.clients (phone_e164) values ('+37060000001')$$, 'family with only a phone');
select lives_ok($$insert into public.clients (id) values ('c9000000-0000-4000-8000-000000000009')$$, 'family without any contact');
select col_not_null('public', 'pets', 'client_id', 'a pet always belongs to a family');

-- label: name, else phone, else e-mail, else the pets' names
insert into public.pets (id, client_id, name, species) values
  ('d9000000-0000-4000-8000-000000000009', 'c9000000-0000-4000-8000-000000000009', 'Rudis', 'dog'),
  ('d9100000-0000-4000-8000-000000000009', 'c9000000-0000-4000-8000-000000000009', 'Bimas', 'dog');
select is((select public.client_label(c) from public.clients c where id = 'c9000000-0000-4000-8000-000000000009'),
  'Bimas, Rudis', 'contact-less family shown by its pets');
select is((select public.client_label(c) from public.clients c where phone_e164 = '+37060000001'),
  '+37060000001', 'phone-only family shown by its phone');
select is((select public.client_label(c) from public.clients c where id = 'c1000000-0000-4000-8000-000000000001'),
  'Rasa Petrauskienė', 'named family shown by its name');

-- booking a pet without passing the family: the pet's family is used
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'a0000000-0000-4000-8000-00000000000a',
    p_start_at   => date_trunc('day', now() + interval '30 days') + interval '10 hours',
    p_end_at     => date_trunc('day', now() + interval '30 days') + interval '11 hours',
    p_items      => '[{"pet_id":"d9000000-0000-4000-8000-000000000009","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]'
  ), null, 'booking without passing the family');
select is(
  (select b.client_id from public.bookings b join public.booking_items bi on bi.booking_id = b.id
    where bi.pet_id = 'd9000000-0000-4000-8000-000000000009'),
  'c9000000-0000-4000-8000-000000000009'::uuid, 'booking belongs to the pet''s family');

-- brand-new pets, no contact: one new family for them
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'b0000000-0000-4000-8000-00000000000b',
    p_start_at   => '2026-10-27 10:00 Europe/Vilnius',
    p_end_at     => '2026-10-27 12:00 Europe/Vilnius',
    p_items      => '[{"new_pet":{"name":"Pilkė","species":"cat"},"service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30},
                      {"new_pet":{"name":"Pūkė","species":"cat"},"service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]'
  ), null, 'two new pets, no contact');
select is((select count(distinct client_id)::int from public.pets where name in ('Pilkė', 'Pūkė')), 1, 'one new family for both');
select is((select c.full_name from public.pets p join public.clients c on c.id = p.client_id where p.name = 'Pilkė'),
  null, 'no made-up family name');

-- a new pet with only a phone
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'a0000000-0000-4000-8000-00000000000a',
    p_start_at   => '2026-10-28 10:00 Europe/Vilnius',
    p_end_at     => '2026-10-28 11:00 Europe/Vilnius',
    p_items      => '[{"new_pet":{"name":"Taška","species":"dog"},"service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]',
    p_new_client => '{"phone_e164":"+37060000002"}'
  ), null, 'new pet with a phone-only family');
select is(
  (select c.phone_e164 from public.pets p join public.clients c on c.id = p.client_id where p.name = 'Taška'),
  '+37060000002', 'pet in the phone-only family');

-- a pet cannot join another family's booking
select throws_ok(
  $$select public.create_booking_with_items(
      p_groomer_id => 'a0000000-0000-4000-8000-00000000000a',
      p_start_at   => '2026-10-29 10:00 Europe/Vilnius',
      p_end_at     => '2026-10-29 11:00 Europe/Vilnius',
      p_client_id  => 'c1000000-0000-4000-8000-000000000001',
      p_items      => '[{"pet_id":"d9000000-0000-4000-8000-000000000009","service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]')$$,
  '23514', null, 'pet of another family is rejected');

-- move Rudis to a new family with an e-mail; his upcoming booking follows
select isnt(public.set_pet_owner('d9000000-0000-4000-8000-000000000009', null, '{"email":"rudzio@pastas.lt"}'),
  null::uuid, 'moved to a new family');
select is(
  (select c.email from public.bookings b join public.clients c on c.id = b.client_id
     join public.booking_items bi on bi.booking_id = b.id
    where bi.pet_id = 'd9000000-0000-4000-8000-000000000009'),
  'rudzio@pastas.lt', 'upcoming booking follows the pet');

select * from finish();
rollback;
