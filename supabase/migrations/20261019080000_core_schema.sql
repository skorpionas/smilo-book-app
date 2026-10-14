-- Smilo Book App — core schema (issue #5)
-- All timestamps are timestamptz (stored UTC, displayed in Europe/Vilnius).

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_trgm   with schema extensions;
create extension if not exists unaccent  with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Immutable wrapper so unaccent can be used in indexes and generated columns.
create or replace function public.f_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value)
$$;

-- Lower-cased, accent-free form used for search ("Žuikis" -> "zuikis").
create or replace function public.f_search_norm(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select lower(public.f_unaccent(value))
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.pet_species    as enum ('dog', 'cat');
create type public.pet_size       as enum ('xs', 's', 'm', 'l', 'xl');
create type public.booking_kind   as enum ('booking', 'block');
create type public.booking_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.groomers (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 50),
  color       text not null default '#0d9488' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.clients (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  full_name      text not null check (char_length(full_name) between 2 and 100),
  phone_e164     text check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  email          text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes          text not null default '',
  archived_at    timestamptz,
  anonymized_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.pets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id    uuid not null references public.clients (id) on delete restrict,
  name         text not null check (char_length(name) between 1 and 50),
  species      public.pet_species not null,
  breed        text not null default '',
  size         public.pet_size,
  weight_kg    numeric(4,1) check (weight_kg is null or weight_kg between 0.5 and 120),
  birth_date   date check (birth_date is null or birth_date <= current_date),
  notes        text not null default '',
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.services (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                  text not null check (char_length(name) between 1 and 80),
  default_duration_min  int not null check (default_duration_min between 15 and 600 and default_duration_min % 15 = 0),
  default_price         numeric(8,2) not null check (default_price between 0 and 9999.99),
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind          public.booking_kind not null default 'booking',
  groomer_id    uuid not null references public.groomers (id) on delete restrict,
  client_id     uuid references public.clients (id) on delete restrict,
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  -- null when end <= start, so the check constraint below reports it (23514)
  during        tstzrange generated always as (
                  case when end_at > start_at then tstzrange(start_at, end_at, '[)') end
                ) stored,
  status        public.booking_status not null default 'scheduled',
  notes         text not null default '',
  block_reason  text not null default '',
  cancelled_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint bookings_end_after_start check (end_at > start_at),
  -- 15-minute grid (900 s). bigint keeps this valid after 2038.
  constraint bookings_15min_grid check (
    extract(epoch from start_at)::bigint % 900 = 0
    and extract(epoch from end_at)::bigint % 900 = 0
  ),
  constraint bookings_client_required check (
    (kind = 'booking' and client_id is not null)
    or (kind = 'block' and client_id is null)
  ),
  -- Blocked time is never "completed" / "no_show".
  constraint bookings_block_status check (kind = 'booking' or status in ('scheduled', 'cancelled')),
  -- One groomer cannot be in two places at once. Cancelled rows free the slot;
  -- no-shows keep it (the time was lost). Blocks live in the same table so this
  -- single constraint also prevents booking over blocked time.
  constraint bookings_no_overlap
    exclude using gist (groomer_id with =, during with &&)
    where (status <> 'cancelled')
);

create table public.booking_items (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  booking_id     uuid not null references public.bookings (id) on delete cascade,
  pet_id         uuid not null references public.pets (id) on delete restrict,
  service_id     uuid not null references public.services (id) on delete restrict,
  duration_min   int not null check (duration_min between 15 and 600 and duration_min % 15 = 0),
  planned_price  numeric(8,2) not null check (planned_price between 0 and 9999.99),
  actual_price   numeric(8,2) check (actual_price is null or actual_price between 0 and 9999.99),
  visit_notes    text not null default '',
  position       int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- Every pet in a booking must belong to the booking's client.
create or replace function public.check_booking_item_pet()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_booking_client uuid;
  v_pet_client     uuid;
begin
  select client_id into v_booking_client from public.bookings where id = new.booking_id;
  select client_id into v_pet_client     from public.pets     where id = new.pet_id;
  if v_booking_client is null or v_pet_client is distinct from v_booking_client then
    raise exception 'pet % does not belong to the client of booking %', new.pet_id, new.booking_id
      using errcode = '23514', constraint = 'booking_items_pet_matches_client';
  end if;
  return new;
end;
$$;

create trigger booking_items_pet_matches_client
  before insert or update of pet_id, booking_id on public.booking_items
  for each row execute function public.check_booking_item_pet();

-- Keep cancelled_at / completed_at in sync with status.
create or replace function public.sync_booking_status_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and (tg_op = 'INSERT' or old.status is distinct from 'cancelled') then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  elsif new.status <> 'cancelled' then
    new.cancelled_at := null;
  end if;

  if new.status in ('completed', 'no_show') and (tg_op = 'INSERT' or old.status not in ('completed', 'no_show')) then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status not in ('completed', 'no_show') then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger bookings_status_timestamps
  before insert or update of status on public.bookings
  for each row execute function public.sync_booking_status_timestamps();

do $$
declare
  t text;
begin
  foreach t in array array['groomers', 'clients', 'pets', 'services', 'bookings', 'booking_items'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index bookings_start_at_idx         on public.bookings (owner_id, start_at);
create index bookings_client_idx           on public.bookings (client_id, start_at desc);
create index booking_items_booking_idx     on public.booking_items (booking_id);
create index booking_items_pet_idx         on public.booking_items (pet_id);
create index booking_items_service_idx     on public.booking_items (service_id);
create index pets_client_idx               on public.pets (client_id);
create index groomers_owner_idx            on public.groomers (owner_id, sort_order);
create index services_owner_idx            on public.services (owner_id);

-- A phone number identifies one active client per owner. [Assumption A3]
create unique index clients_owner_phone_uniq
  on public.clients (owner_id, phone_e164)
  where phone_e164 is not null and anonymized_at is null;

-- Search: trigram on accent-free names, plain trigram on phone digits.
create index clients_name_trgm_idx  on public.clients using gin (public.f_search_norm(full_name) extensions.gin_trgm_ops);
create index clients_phone_trgm_idx on public.clients using gin (phone_e164 extensions.gin_trgm_ops);
create index pets_name_trgm_idx     on public.pets    using gin (public.f_search_norm(name) extensions.gin_trgm_ops);
