-- Several pets at once (owner feedback 2026-10-16): households bring 2–4 pets that
-- are always groomed together. Adding them one by one took too long.
--
--   create_pets(p_pets, p_client_id, p_new_client)
--     adds several pets in one go, under an existing client, a new contact card,
--     or — with no contact at all and 2+ pets — a family card named after the pets.
--   create_booking_with_items
--     same family rule when a booking brings 2+ brand-new pets and no contact.

create or replace function public.create_pets(
  p_pets       jsonb,
  p_client_id  uuid  default null,
  p_new_client jsonb default null
)
returns table (pet_id uuid, client_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client_id uuid := p_client_id;
  v_pet       jsonb;
  v_pos       int;
begin
  if p_pets is null or jsonb_typeof(p_pets) <> 'array'
     or jsonb_array_length(p_pets) = 0 or jsonb_array_length(p_pets) > 10 then
    raise exception '1–10 pets are required' using errcode = '22023';
  end if;

  if v_client_id is null and p_new_client is not null and jsonb_typeof(p_new_client) = 'object'
     and coalesce(nullif(trim(p_new_client ->> 'full_name'), ''), nullif(p_new_client ->> 'phone_e164', ''),
                  nullif(p_new_client ->> 'email', '')) is not null then
    insert into public.clients (full_name, phone_e164, email)
    values (
      nullif(trim(p_new_client ->> 'full_name'), ''),
      nullif(p_new_client ->> 'phone_e164', ''),
      nullif(p_new_client ->> 'email', '')
    )
    returning id into v_client_id;
  end if;

  -- No contact, several pets: one family card named after them
  if v_client_id is null and jsonb_array_length(p_pets) >= 2 then
    insert into public.clients (full_name)
    select left(string_agg(trim(e ->> 'name'), ', ' order by o), 100)
    from jsonb_array_elements(p_pets) with ordinality as x(e, o)
    returning id into v_client_id;
  end if;

  for v_pet, v_pos in select value, ordinality::int from jsonb_array_elements(p_pets) with ordinality loop
    pet_id := null;
    insert into public.pets (client_id, name, species, breed)
    values (
      v_client_id,
      trim(v_pet ->> 'name'),
      (v_pet ->> 'species')::public.pet_species,
      coalesce(trim(v_pet ->> 'breed'), '')
    )
    returning id into pet_id;
    client_id := v_client_id;
    return next;
  end loop;
end;
$$;

revoke execute on function public.create_pets(jsonb, uuid, jsonb) from public, anon;
grant  execute on function public.create_pets(jsonb, uuid, jsonb) to authenticated;

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
