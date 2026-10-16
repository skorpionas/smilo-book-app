-- Several pets at once: create_pets and the family rule in create_booking_with_items.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(11);

\ir fixture.psql

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- three pets, a phone-only contact: one card, three pets on it
select is(
  (select count(distinct client_id)::int from public.create_pets(
     '[{"name":"Bim","species":"dog"},{"name":"Bom","species":"dog"},{"name":"Murkė","species":"cat"}]',
     null, '{"phone_e164":"+37060000011"}')),
  1, 'three pets share one new contact');
select is((select count(*)::int from public.pets p join public.clients c on c.id = p.client_id
            where c.phone_e164 = '+37060000011'), 3, 'all three linked to it');

-- two pets, no contact: a family card named after them
select is(
  (select count(distinct client_id)::int from public.create_pets('[{"name":"Aras","species":"dog"},{"name":"Bars","species":"dog"}]')),
  1, 'no contact, two pets: one shared card');
-- (a separate statement: rows inserted by the function are not visible to the same SELECT)
select is((select c.full_name from public.pets p join public.clients c on c.id = p.client_id where p.name = 'Aras'),
  'Aras, Bars', 'family card named after the pets');

-- one pet, no contact: no card
select is(
  (select client_id from public.create_pets('[{"name":"Vienas","species":"cat"}]')),
  null::uuid, 'single pet without contact has no owner');

-- under an existing client
select is(
  (select count(*)::int from public.create_pets('[{"name":"Trečias","species":"dog"},{"name":"Ketvirtas","species":"dog"}]',
     'c2000000-0000-4000-8000-000000000002')),
  2, 'added under an existing client');
select is((select count(*)::int from public.pets where client_id = 'c2000000-0000-4000-8000-000000000002'), 3,
  'client now has three pets');

select throws_ok($$select * from public.create_pets('[]')$$, '22023', null, 'empty list rejected');
select throws_ok($$select * from public.create_pets('[{"name":"X","species":"cow"}]')$$, '22P02', null, 'bad species rejected');

-- booking with two brand-new pets and no contact: grouped as a family
select isnt(
  public.create_booking_with_items(
    p_groomer_id => 'a0000000-0000-4000-8000-00000000000a',
    p_start_at   => '2026-10-27 10:00 Europe/Vilnius',
    p_end_at     => '2026-10-27 12:00 Europe/Vilnius',
    p_items      => '[{"new_pet":{"name":"Pupa","species":"dog"},"service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30},
                      {"new_pet":{"name":"Pupytė","species":"dog"},"service_id":"e1000000-0000-4000-8000-000000000001","duration_min":60,"planned_price":30}]'
  ), null, 'booking two new pets without contact');
select is(
  (select c.full_name from public.pets p join public.clients c on c.id = p.client_id where p.name = 'Pupytė'),
  'Pupa, Pupytė', 'booked pets grouped on one family card');

select * from finish();
rollback;
