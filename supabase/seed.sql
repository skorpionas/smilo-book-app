-- Local / preview seed data (issue #8). Fake Lithuanian names only.
-- Login: owner@smilo.local / smilo-dev-password   (LOCAL ONLY — never seed prod)
--
-- 2 groomers, 6 services, 20 clients, 30 pets, ~60 bookings between
-- 2026-10-12 and 2026-11-08 (includes the DST change on 2026-10-25),
-- one full-day holiday block and a few evening blocks.

-- ---------------------------------------------------------------------------
-- Owner account
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '0a000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'owner@smilo.local',
  extensions.crypt('smilo-dev-password', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '',
  -- GoTrue scans these as non-null strings; NULL breaks password login
  '', '', '', ''
);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  '0a000000-0000-4000-8000-000000000001',
  '0a000000-0000-4000-8000-000000000001',
  '{"sub":"0a000000-0000-4000-8000-000000000001","email":"owner@smilo.local","email_verified":true}',
  'email', now(), now(), now()
);

-- ---------------------------------------------------------------------------
-- Groomers and services
-- ---------------------------------------------------------------------------
insert into public.groomers (id, owner_id, name, color, sort_order) values
  ('0b000000-0000-4000-8000-00000000000a', '0a000000-0000-4000-8000-000000000001', 'Meistrė A', '#0d9488', 1),
  ('0b000000-0000-4000-8000-00000000000b', '0a000000-0000-4000-8000-000000000001', 'Meistrė B', '#d97706', 2);

insert into public.services (owner_id, name, default_duration_min, default_price) values
  ('0a000000-0000-4000-8000-000000000001', 'Pilnas kirpimas',          120, 40.00),
  ('0a000000-0000-4000-8000-000000000001', 'Maudymas ir džiovinimas',   90, 30.00),
  ('0a000000-0000-4000-8000-000000000001', 'Higieninis kirpimas',       90, 28.00),
  ('0a000000-0000-4000-8000-000000000001', 'Kailio iššukavimas',        90, 32.00),
  ('0a000000-0000-4000-8000-000000000001', 'Didelio šuns kirpimas',    180, 65.00),
  ('0a000000-0000-4000-8000-000000000001', 'Katės kirpimas',           120, 45.00);

-- ---------------------------------------------------------------------------
-- Clients (20) and pets (30: clients 1–10 have two pets, 11–20 one)
-- ---------------------------------------------------------------------------
with names(n, full_name, phone) as (
  values
    ( 1, 'Rasa Petrauskienė',     '+37061234567'), ( 2, 'Jonas Kazlauskas',     '+37061200001'),
    ( 3, 'Aistė Jankauskaitė',    '+37061200002'), ( 4, 'Mantas Žukauskas',     '+37061200003'),
    ( 5, 'Eglė Butkienė',         '+37061200004'), ( 6, 'Tomas Paulauskas',     '+37061200005'),
    ( 7, 'Greta Vasiliauskaitė',  '+37061200006'), ( 8, 'Lukas Stankevičius',   '+37061200007'),
    ( 9, 'Ieva Urbonienė',        '+37061200008'), (10, 'Darius Navickas',      '+37061200009'),
    (11, 'Simona Kavaliauskienė', '+37061200010'), (12, 'Paulius Ramanauskas',  '+37061200011'),
    (13, 'Justina Šimkutė',       '+37061200012'), (14, 'Andrius Baranauskas',  '+37061200013'),
    (15, 'Viktorija Žilinskienė', '+37061200014'), (16, 'Karolis Sakalauskas',  '+37061200015'),
    (17, 'Monika Vaitkutė',       '+37061200016'), (18, 'Gintaras Mockus',      '+37061200017'),
    (19, 'Laura Adomaitienė',     '+37061200018'), (20, 'Rokas Kairys',         '+37061200019')
)
insert into public.clients (id, owner_id, full_name, phone_e164, notes)
select
  ('0c000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '0a000000-0000-4000-8000-000000000001',
  full_name, phone,
  case when n % 7 = 0 then 'Skambinti tik po 17:00' else '' end
from names;

with pets(n, client_n, name, species, breed, size, weight, notes) as (
  values
    ( 1,  1, 'Maksas',  'dog', 'Pudelis',              'm',  12.0, 'Nemėgsta plaukų džiovintuvo'),
    ( 2,  1, 'Žuikis',  'cat', 'Persų',                null,  4.5, ''),
    ( 3,  2, 'Reksas',  'dog', 'Vokiečių aviganis',    'xl', 38.0, 'Gali kąsti — antsnukis!'),
    ( 4,  2, 'Bela',    'dog', 'Bišonas',              's',   6.5, ''),
    ( 5,  3, 'Čarlis',  'dog', 'Jorkšyro terjeras',    'xs',  3.0, ''),
    ( 6,  3, 'Murka',   'cat', 'Meinkūnas',            null,  6.8, 'Alergija šampūnui su avižomis'),
    ( 7,  4, 'Bruklinas','dog','Šnauceris',            'm',  14.0, ''),
    ( 8,  4, 'Lė',      'dog', 'Ši cu',                's',   6.0, ''),
    ( 9,  5, 'Tobis',   'dog', 'Auksaspalvis retriveris','l', 30.0, 'Kailis linkęs susivelti'),
    (10,  5, 'Pūkas',   'cat', 'Britų trumpaplaukė',   null,  5.0, ''),
    (11,  6, 'Ronis',   'dog', 'Kokerspanielis',       'm',  13.0, ''),
    (12,  6, 'Lūna',    'dog', 'Maltietis',            'xs',  3.2, ''),
    (13,  7, 'Bonis',   'dog', 'Samojedas',            'l',  25.0, ''),
    (14,  7, 'Kikis',   'cat', 'Ragdolas',             null,  5.5, ''),
    (15,  8, 'Džeris',  'dog', 'Pomeranijos špicas',   'xs',  2.5, 'Labai bijo, dirbti lėtai'),
    (16,  8, 'Sniegė',  'dog', 'Vakarų Škotijos terjeras','s', 8.0, ''),
    (17,  9, 'Oskaras', 'dog', 'Labradoodle',          'l',  27.0, ''),
    (18,  9, 'Mimi',    'cat', 'Sibiro',               null,  4.8, ''),
    (19, 10, 'Ares',    'dog', 'Sibiro haskis',        'l',  24.0, ''),
    (20, 10, 'Dora',    'dog', 'Taksas',               's',   7.0, ''),
    (21, 11, 'Fifi',    'dog', 'Pudelis (toy)',        'xs',  3.5, ''),
    (22, 12, 'Brutas',  'dog', 'Niufaundlendas',       'xl', 60.0, 'Reikia dviejų žmonių'),
    (23, 13, 'Tigras',  'cat', 'Persų',                null,  4.2, ''),
    (24, 14, 'Marlis',  'dog', 'Bernų zenenhundas',    'xl', 45.0, ''),
    (25, 15, 'Kokosas', 'dog', 'Bišonas',              's',   6.2, ''),
    (26, 16, 'Rudis',   'dog', 'Airių seteris',        'l',  28.0, ''),
    (27, 17, 'Pupa',    'dog', 'Mopsas',               's',   8.5, 'Kvėpavimo problemos'),
    (28, 18, 'Herkus',  'dog', 'Čau čau',              'm',  22.0, ''),
    (29, 19, 'Mila',    'cat', 'Meinkūnas',            null,  7.0, ''),
    (30, 20, 'Bobis',   'dog', 'Kokerspanielis',       'm',  12.5, '')
)
insert into public.pets (id, owner_id, client_id, name, species, breed, size, weight_kg, birth_date, notes)
select
  ('0d000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '0a000000-0000-4000-8000-000000000001',
  ('0c000000-0000-4000-8000-' || lpad(client_n::text, 12, '0'))::uuid,
  name, species::public.pet_species, breed, size::public.pet_size, weight,
  date '2016-03-01' + (n * 97 % 3000),
  notes
from pets;

-- ---------------------------------------------------------------------------
-- Bookings: Mon–Sat, per groomer up to 3 slots (09:00, 11:30, 14:30 Vilnius).
-- A deterministic filter keeps ~60. Groomer A is on holiday on 2026-10-30.
-- ---------------------------------------------------------------------------
create temporary table _slots as
with days as (
  select d::date as day, row_number() over (order by d) as day_n
  from generate_series(date '2026-10-12', date '2026-11-08', interval '1 day') d
  where extract(isodow from d) between 1 and 6
),
groomers(g_n, groomer_id) as (
  values (1, '0b000000-0000-4000-8000-00000000000a'::uuid),
         (2, '0b000000-0000-4000-8000-00000000000b'::uuid)
),
slots(s_n, start_local, max_min) as (
  values (1, time '09:00', 150), (2, time '11:30', 180), (3, time '14:30', 180)
)
select
  row_number() over (order by day, g_n, s_n) as i,
  day, groomer_id, s_n, start_local, max_min
from days, groomers, slots
where (day_n * 7 + g_n * 3 + s_n * 5) % 12 < 5
  and not (g_n = 1 and day = date '2026-10-30');

create temporary table _bk as
select
  ('0e000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid as id,
  i, groomer_id,
  -- clients cycle; clients 1–10 own two pets
  ((i - 1) % 20) + 1 as client_n,
  (day + start_local) at time zone 'Europe/Vilnius' as start_at,
  case
    when s_n = 1 then case when i % 2 = 0 then 120 else 90 end
    else case when i % 3 = 0 then 180 when i % 3 = 1 then 120 else 90 end
  end as duration_min
from _slots;

insert into public.bookings (id, owner_id, kind, groomer_id, client_id, start_at, end_at, status, notes)
select
  id,
  '0a000000-0000-4000-8000-000000000001', 'booking', groomer_id,
  ('0c000000-0000-4000-8000-' || lpad(client_n::text, 12, '0'))::uuid,
  start_at,
  start_at + make_interval(mins => duration_min),
  case
    when start_at >= now() then 'scheduled'
    when i % 11 = 0 then 'no_show'
    when i % 13 = 0 then 'cancelled'
    else 'completed'
  end::public.booking_status,
  case when i % 9 = 0 then 'Klientas prašė paskambinti prieš atvykstant' else '' end
from _bk;

-- One item per booking; every 4th booking of a two-pet client brings both pets.
insert into public.booking_items (owner_id, booking_id, pet_id, service_id, duration_min, planned_price, actual_price, visit_notes, position)
select
  '0a000000-0000-4000-8000-000000000001',
  b.id, p.pet_id, s.id,
  case
    when not p.two  then b.duration_min
    when p.pos = 1  then (b.duration_min / 2) / 15 * 15
    else b.duration_min - (b.duration_min / 2) / 15 * 15
  end,
  s.default_price,
  case when bk.status = 'completed' then s.default_price + (b.i % 3) * 5 end,
  case when bk.status = 'completed' and b.i % 4 = 0 then 'Kailis susivėlęs, kitą kartą trumpiau' else '' end,
  p.pos
from _bk b
join public.bookings bk on bk.id = b.id
cross join lateral (
  select
    ('0d000000-0000-4000-8000-' || lpad(pet_n::text, 12, '0'))::uuid as pet_id,
    pos,
    (b.client_n <= 10 and b.i % 4 = 0) as two
  from (values
    (case when b.client_n <= 10 then b.client_n * 2 - 1 else b.client_n + 10 end, 1),
    (case when b.client_n <= 10 then b.client_n * 2     else null end,            2)
  ) v(pet_n, pos)
  where pos = 1 or (b.client_n <= 10 and b.i % 4 = 0)
) p
cross join lateral (
  select id, default_price from public.services
  where owner_id = '0a000000-0000-4000-8000-000000000001'
  order by created_at, name
  offset (b.i % 6) limit 1
) s;

-- ---------------------------------------------------------------------------
-- Blocked time
-- ---------------------------------------------------------------------------
insert into public.bookings (owner_id, kind, groomer_id, start_at, end_at, block_reason) values
  ('0a000000-0000-4000-8000-000000000001', 'block', '0b000000-0000-4000-8000-00000000000a',
   '2026-10-30 08:00 Europe/Vilnius', '2026-10-30 19:00 Europe/Vilnius', 'Atostogos'),
  ('0a000000-0000-4000-8000-000000000001', 'block', '0b000000-0000-4000-8000-00000000000b',
   '2026-10-21 17:30 Europe/Vilnius', '2026-10-21 19:00 Europe/Vilnius', 'Vizitas pas gydytoją'),
  ('0a000000-0000-4000-8000-000000000001', 'block', '0b000000-0000-4000-8000-00000000000a',
   '2026-11-04 17:30 Europe/Vilnius', '2026-11-04 19:00 Europe/Vilnius', 'Mokymai');

drop table _bk;
drop table _slots;
