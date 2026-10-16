-- Per-pet services (owner feedback 2026-10-16): many pets have their own usual
-- service with a custom duration and price. Booking that pet pre-fills them, so a
-- regular client is booked in a few taps. A client with two dogs keeps a separate
-- list for each dog.
--
-- Pre-fill order for (pet, service): pet_services → last completed actual price →
-- the service's default.

create table public.pet_services (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pet_id        uuid not null references public.pets (id) on delete cascade,
  service_id    uuid not null references public.services (id) on delete restrict,
  duration_min  int not null check (duration_min between 15 and 600 and duration_min % 15 = 0),
  price         numeric(8,2) not null check (price between 0 and 9999.99),
  -- 0 = the pet's usual service, picked automatically when the pet is booked
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint pet_services_pet_service_uniq unique (pet_id, service_id)
);

comment on table public.pet_services is
  'Custom duration and price of a service for one pet. position 0 = the pet''s usual service.';

create index pet_services_owner_idx   on public.pet_services (owner_id);
create index pet_services_service_idx on public.pet_services (service_id);

create trigger pet_services_updated_at
  before update on public.pet_services
  for each row execute function public.set_updated_at();

alter table public.pet_services enable row level security;
revoke all on public.pet_services from anon;

create policy pet_services_owner_all on public.pet_services for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.pets p     where p.id = pet_id     and p.owner_id = (select auth.uid()))
    and exists (select 1 from public.services s where s.id = service_id and s.owner_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Pre-fill: the pet's own price first.
-- ---------------------------------------------------------------------------
create or replace function public.get_price_prefill(p_pet_id uuid, p_service_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select ps.price from public.pet_services ps where ps.pet_id = p_pet_id and ps.service_id = p_service_id),
    (
      select bi.actual_price
      from public.booking_items bi
      join public.bookings b on b.id = bi.booking_id
      where bi.pet_id = p_pet_id
        and bi.service_id = p_service_id
        and b.status = 'completed'
        and bi.actual_price is not null
      order by b.start_at desc
      limit 1
    ),
    (select s.default_price from public.services s where s.id = p_service_id)
  )
$$;

-- ---------------------------------------------------------------------------
-- create_booking_with_items: an item may carry "remember": true, which saves its
-- duration and price as the pet's own service (also for a pet created here).
-- ---------------------------------------------------------------------------
create or replace function public.create_booking_with_items(
  p_groomer_id  uuid,
  p_start_at    timestamptz,
  p_end_at      timestamptz,
  p_items       jsonb,
  p_client_id   uuid  default null,
  p_new_client  jsonb default null,
  p_notes       text  default ''
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client_id  uuid := p_client_id;
  v_booking_id uuid;
  v_item       jsonb;
  v_pos        int;
  v_pet_id     uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'at least one booking item is required' using errcode = '22023';
  end if;

  if v_client_id is null then
    if p_new_client is null then
      raise exception 'client_id or new_client is required' using errcode = '22023';
    end if;
    insert into public.clients (full_name, phone_e164, email)
    values (
      trim(p_new_client ->> 'full_name'),
      nullif(p_new_client ->> 'phone_e164', ''),
      nullif(p_new_client ->> 'email', '')
    )
    returning id into v_client_id;
  end if;

  insert into public.bookings (kind, groomer_id, client_id, start_at, end_at, notes)
  values ('booking', p_groomer_id, v_client_id, p_start_at, p_end_at, coalesce(p_notes, ''))
  returning id into v_booking_id;

  for v_item, v_pos in
    select value, ordinality::int from jsonb_array_elements(p_items) with ordinality
  loop
    v_pet_id := nullif(v_item ->> 'pet_id', '')::uuid;
    if v_pet_id is null then
      if v_item -> 'new_pet' is null or jsonb_typeof(v_item -> 'new_pet') <> 'object' then
        raise exception 'item % needs pet_id or new_pet', v_pos using errcode = '22023';
      end if;
      insert into public.pets (client_id, name, species, breed)
      values (
        v_client_id,
        trim(v_item -> 'new_pet' ->> 'name'),
        (v_item -> 'new_pet' ->> 'species')::public.pet_species,
        coalesce(trim(v_item -> 'new_pet' ->> 'breed'), '')
      )
      returning id into v_pet_id;
    end if;

    insert into public.booking_items (booking_id, pet_id, service_id, duration_min, planned_price, position)
    values (
      v_booking_id,
      v_pet_id,
      (v_item ->> 'service_id')::uuid,
      (v_item ->> 'duration_min')::int,
      (v_item ->> 'planned_price')::numeric,
      v_pos
    );

    if coalesce((v_item ->> 'remember')::boolean, false) then
      insert into public.pet_services (pet_id, service_id, duration_min, price, position)
      values (
        v_pet_id,
        (v_item ->> 'service_id')::uuid,
        (v_item ->> 'duration_min')::int,
        (v_item ->> 'planned_price')::numeric,
        (select count(*) from public.pet_services ps where ps.pet_id = v_pet_id)
      )
      on conflict (pet_id, service_id) do update
        set duration_min = excluded.duration_min,
            price        = excluded.price;
    end if;
  end loop;

  return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hygiene (security review 2026-10-16): no function is callable by anon.
-- Trigger and helper functions were executable by PUBLIC by default; they leak
-- nothing, but the API surface for a logged-out visitor should be empty.
-- ---------------------------------------------------------------------------
revoke execute on function public.f_unaccent(text)                     from public, anon;
revoke execute on function public.f_search_norm(text)                  from public, anon;
revoke execute on function public.set_updated_at()                     from public, anon;
revoke execute on function public.check_booking_item_pet()             from public, anon;
revoke execute on function public.sync_booking_status_timestamps()     from public, anon;
grant  execute on function public.f_unaccent(text)                     to authenticated;
grant  execute on function public.f_search_norm(text)                  to authenticated;
grant  execute on function public.set_updated_at()                     to authenticated;
grant  execute on function public.check_booking_item_pet()             to authenticated;
grant  execute on function public.sync_booking_status_timestamps()     to authenticated;

-- New functions in this schema default to no access for anon / PUBLIC.
alter default privileges in schema public revoke execute on functions from public, anon;
