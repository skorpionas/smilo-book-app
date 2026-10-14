-- Overlap prevention and check constraints (issue #6, US-09, US-16)
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(18);

\ir fixture.psql

-- Shorthand ids
\set gA '''a0000000-0000-4000-8000-00000000000a'''
\set gB '''b0000000-0000-4000-8000-00000000000b'''
\set c1 '''c1000000-0000-4000-8000-000000000001'''
\set c2 '''c2000000-0000-4000-8000-000000000002'''
\set o1 '''11111111-1111-4111-8111-111111111111'''

-- 1. base booking for groomer A 10:00–12:00 Vilnius time
select lives_ok(
  format($$insert into bookings (id, owner_id, groomer_id, client_id, start_at, end_at)
           values ('f0000000-0000-4000-8000-000000000001', %L, %L, %L,
                   '2026-10-20 10:00 Europe/Vilnius', '2026-10-20 12:00 Europe/Vilnius')$$, :o1, :gA, :c1),
  'groomer A can be booked 10:00–12:00');

-- 2. same groomer overlapping → exclusion violation
select throws_ok(
  format($$insert into bookings (owner_id, groomer_id, client_id, start_at, end_at)
           values (%L, %L, %L, '2026-10-20 11:00 Europe/Vilnius', '2026-10-20 12:30 Europe/Vilnius')$$, :o1, :gA, :c2),
  '23P01', null, 'overlapping booking for the same groomer is rejected');

-- 3. other groomer, same time → fine
select lives_ok(
  format($$insert into bookings (owner_id, groomer_id, client_id, start_at, end_at)
           values (%L, %L, %L, '2026-10-20 11:00 Europe/Vilnius', '2026-10-20 12:30 Europe/Vilnius')$$, :o1, :gB, :c2),
  'the other groomer can be booked at the same time');

-- 4. adjacent [) ranges do not overlap
select lives_ok(
  format($$insert into bookings (owner_id, groomer_id, client_id, start_at, end_at)
           values (%L, %L, %L, '2026-10-20 12:00 Europe/Vilnius', '2026-10-20 14:00 Europe/Vilnius')$$, :o1, :gA, :c2),
  'adjacent booking 12:00–14:00 is allowed');

-- 5–6. cancelling frees the slot and stamps cancelled_at
update bookings set status = 'cancelled' where id = 'f0000000-0000-4000-8000-000000000001';
select isnt(
  (select cancelled_at from bookings where id = 'f0000000-0000-4000-8000-000000000001'), null,
  'cancelling sets cancelled_at');
select lives_ok(
  format($$insert into bookings (id, owner_id, groomer_id, client_id, start_at, end_at)
           values ('f0000000-0000-4000-8000-000000000002', %L, %L, %L,
                   '2026-10-20 10:00 Europe/Vilnius', '2026-10-20 12:00 Europe/Vilnius')$$, :o1, :gA, :c2),
  'a cancelled booking frees its slot');

-- 7–8. a no-show keeps the slot occupied
update bookings set status = 'no_show' where id = 'f0000000-0000-4000-8000-000000000002';
select isnt(
  (select completed_at from bookings where id = 'f0000000-0000-4000-8000-000000000002'), null,
  'no_show sets completed_at');
select throws_ok(
  format($$insert into bookings (owner_id, groomer_id, client_id, start_at, end_at)
           values (%L, %L, %L, '2026-10-20 10:00 Europe/Vilnius', '2026-10-20 11:00 Europe/Vilnius')$$, :o1, :gA, :c1),
  '23P01', null, 'a no-show keeps the slot occupied');

-- 9–10. blocked time participates in the same constraint
select lives_ok(
  format($$insert into bookings (owner_id, kind, groomer_id, start_at, end_at, block_reason)
           values (%L, 'block', %L, '2026-10-20 13:00 Europe/Vilnius', '2026-10-20 15:00 Europe/Vilnius', 'Pertrauka')$$, :o1, :gB),
  'a block can be added for groomer B');
select throws_ok(
  format($$insert into bookings (owner_id, groomer_id, client_id, start_at, end_at)
           values (%L, %L, %L, '2026-10-20 14:00 Europe/Vilnius', '2026-10-20 15:00 Europe/Vilnius')$$, :o1, :gB, :c1),
  '23P01', null, 'a booking cannot overlap blocked time');

-- 11. 15-minute grid
select throws_ok(
  format($$insert into bookings (owner_id, groomer_id, client_id, start_at, end_at)
           values (%L, %L, %L, '2026-10-21 10:05 Europe/Vilnius', '2026-10-21 11:00 Europe/Vilnius')$$, :o1, :gA, :c1),
  '23514', null, 'start time off the 15-minute grid is rejected');

-- 12. a booking needs a client
select throws_ok(
  format($$insert into bookings (owner_id, groomer_id, start_at, end_at)
           values (%L, %L, '2026-10-21 10:00 Europe/Vilnius', '2026-10-21 11:00 Europe/Vilnius')$$, :o1, :gA),
  '23514', null, 'a booking without a client is rejected');

-- 13. a block must not have a client
select throws_ok(
  format($$insert into bookings (owner_id, kind, groomer_id, client_id, start_at, end_at)
           values (%L, 'block', %L, %L, '2026-10-21 10:00 Europe/Vilnius', '2026-10-21 11:00 Europe/Vilnius')$$, :o1, :gA, :c1),
  '23514', null, 'a block with a client is rejected');

-- 14. end after start
select throws_ok(
  format($$insert into bookings (owner_id, groomer_id, client_id, start_at, end_at)
           values (%L, %L, %L, '2026-10-21 11:00 Europe/Vilnius', '2026-10-21 10:00 Europe/Vilnius')$$, :o1, :gA, :c1),
  '23514', null, 'end before start is rejected');

-- 15. booking item pet must belong to the booking client
select throws_ok(
  $$insert into booking_items (owner_id, booking_id, pet_id, service_id, duration_min, planned_price)
    values ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000002',
            'd1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 120, 40)$$,
  '23514', null, 'a pet of another client cannot be added to the booking');

-- 16. item duration on the 15-minute grid
select throws_ok(
  $$insert into booking_items (owner_id, booking_id, pet_id, service_id, duration_min, planned_price)
    values ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000002',
            'd3000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001', 50, 40)$$,
  '23514', null, 'item duration must be a multiple of 15');

-- 17–18. DST fall-back day (2026-10-25, 25-hour day): 02:00 EEST → 03:00 EET is 2 real hours
select lives_ok(
  format($$insert into bookings (id, owner_id, groomer_id, client_id, start_at, end_at)
           values ('f0000000-0000-4000-8000-000000000003', %L, %L, %L,
                   '2026-10-25 02:00+03', '2026-10-25 03:00+02')$$, :o1, :gA, :c1),
  'a booking across the DST change is stored');
select is(
  (select end_at - start_at from bookings where id = 'f0000000-0000-4000-8000-000000000003'),
  interval '2 hours',
  'its duration is 2 real hours');

select * from finish();
rollback;
