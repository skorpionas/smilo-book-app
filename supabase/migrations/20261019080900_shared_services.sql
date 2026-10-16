-- One service for several pets (owner feedback 2026-10-16): "Maudymas abiem, 2 h, 50 €".
--
-- A shared service is still stored as one booking_items row per pet (time and price
-- split), so each pet's history and price memory keep working. Rows entered together
-- carry the same shared_group number within their booking, so the app can show them
-- as one line ("Bim + Bom · Maudymas · 50 €").
--
-- client_services: the family's usual shared services — total time and price for all
-- of the client's pets together. Booking "Kartu: Bim + Bom" fills it in.

alter table public.booking_items
  add column shared_group smallint check (shared_group between 1 and 6);

comment on column public.booking_items.shared_group is
  'Rows with the same number in one booking were one shared service for several pets.';

create table public.client_services (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id     uuid not null references public.clients (id) on delete cascade,
  service_id    uuid not null references public.services (id) on delete restrict,
  -- totals for all of the client's pets together
  duration_min  int not null check (duration_min between 15 and 600 and duration_min % 15 = 0),
  price         numeric(8,2) not null check (price between 0 and 9999.99),
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint client_services_client_service_uniq unique (client_id, service_id)
);

comment on table public.client_services is
  'A family''s shared service: total time and price for all its pets together. position 0 = usual.';

create index client_services_owner_idx   on public.client_services (owner_id);
create index client_services_service_idx on public.client_services (service_id);

create trigger client_services_updated_at
  before update on public.client_services
  for each row execute function public.set_updated_at();

alter table public.client_services enable row level security;
revoke all on public.client_services from anon;

create policy client_services_owner_all on public.client_services for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.clients c  where c.id = client_id  and c.owner_id = (select auth.uid()))
    and exists (select 1 from public.services s where s.id = service_id and s.owner_id = (select auth.uid()))
  );

-- create_booking_with_items: keeps shared_group from each item.
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

  if v_client_id is null and p_new_client is not null and jsonb_typeof(p_new_client) = 'object' then
    insert into public.clients (full_name, phone_e164, email)
    values (
      nullif(trim(p_new_client ->> 'full_name'), ''),
      nullif(p_new_client ->> 'phone_e164', ''),
      nullif(p_new_client ->> 'email', '')
    )
    returning id into v_client_id;
  end if;

  -- No client given: take the owner of the first existing pet (if it has one).
  if v_client_id is null then
    select p.client_id into v_client_id
    from jsonb_array_elements(p_items) e
    join public.pets p on p.id = nullif(e ->> 'pet_id', '')::uuid
    where p.client_id is not null
    limit 1;
  end if;

  -- Several brand-new pets and no contact at all: keep them together as one family
  -- card named after the pets ("Bim, Bom, Bum"), so they can be booked together
  -- later. The card can be renamed or given a phone any time.
  if v_client_id is null
     and (select count(*) from jsonb_array_elements(p_items) e where nullif(e ->> 'pet_id', '') is null) >= 2
     and not exists (select 1 from jsonb_array_elements(p_items) e where nullif(e ->> 'pet_id', '') is not null)
  then
    insert into public.clients (full_name)
    select left(string_agg(trim(e -> 'new_pet' ->> 'name'), ', ' order by o), 100)
    from jsonb_array_elements(p_items) with ordinality as x(e, o)
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

    insert into public.booking_items (booking_id, pet_id, service_id, duration_min, planned_price, position, shared_group)
    values (
      v_booking_id,
      v_pet_id,
      (v_item ->> 'service_id')::uuid,
      (v_item ->> 'duration_min')::int,
      (v_item ->> 'planned_price')::numeric,
      v_pos,
      nullif(v_item ->> 'shared_group', '')::smallint
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
