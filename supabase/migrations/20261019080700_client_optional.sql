-- Pet first, client optional (owner feedback 2026-10-16).
-- The pet is the main record. A client (owner / contact card) can be linked or not,
-- and a contact card can be just a phone number or an e-mail: name, phone and e-mail
-- are each optional, but a card needs at least one of them.
--
--   pets.client_id      → nullable (a pet may have no owner record)
--   clients.full_name   → nullable (contact = name and/or phone and/or e-mail)
--   bookings.client_id  → nullable for bookings too; still null for blocked time
--   booking items       → every pet of one booking has the same owner (or none)

-- ---------------------------------------------------------------------------
-- Clients: a contact card with at least one of name / phone / e-mail
-- ---------------------------------------------------------------------------
alter table public.clients
  alter column full_name drop not null,
  drop constraint if exists clients_full_name_check,
  add constraint clients_full_name_len check (full_name is null or char_length(full_name) between 1 and 100),
  add constraint clients_has_contact check (
    nullif(trim(full_name), '') is not null or phone_e164 is not null or email is not null
  );

-- ---------------------------------------------------------------------------
-- Pets: owner optional
-- ---------------------------------------------------------------------------
alter table public.pets alter column client_id drop not null;

drop policy pets_owner_all on public.pets;
create policy pets_owner_all on public.pets for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (client_id is null
         or exists (select 1 from public.clients c where c.id = client_id and c.owner_id = (select auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- Bookings: a booking may have no client; blocked time never has one
-- ---------------------------------------------------------------------------
alter table public.bookings
  drop constraint bookings_client_required,
  add constraint bookings_block_no_client check (kind = 'booking' or client_id is null);

-- Every pet of a booking has the booking's owner — or both have none.
create or replace function public.check_booking_item_pet()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_booking_client uuid;
  v_pet_client     uuid;
  v_found          boolean;
begin
  select true, client_id into v_found, v_booking_client from public.bookings where id = new.booking_id;
  select client_id into v_pet_client from public.pets where id = new.pet_id;
  if v_found is null or v_pet_client is distinct from v_booking_client then
    raise exception 'pet % does not belong to the client of booking %', new.pet_id, new.booking_id
      using errcode = '23514', constraint = 'booking_items_pet_matches_client';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_booking_with_items: client optional.
--  p_client_id      → existing client
--  p_new_client     → new contact card (any of full_name / phone_e164 / email)
--  neither          → no client; the booking's client follows its existing pets
--                     (a pet with an owner brings the owner along)
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
-- set_pet_owner: link a pet (and its future bookings) to an existing client or a
-- new contact card; p_client_id null + p_new_client null unlinks it.
-- Past bookings keep their client (history stays as it was).
-- ---------------------------------------------------------------------------
create or replace function public.set_pet_owner(p_pet_id uuid, p_client_id uuid default null, p_new_client jsonb default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client_id uuid := p_client_id;
begin
  if not exists (select 1 from public.pets where id = p_pet_id) then
    raise exception 'pet not found' using errcode = 'P0002';
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

  update public.pets set client_id = v_client_id where id = p_pet_id;

  -- Upcoming single-pet bookings of this pet follow the new owner.
  update public.bookings b
     set client_id = v_client_id
   where b.status = 'scheduled'
     and b.end_at > now()
     and exists (select 1 from public.booking_items bi where bi.booking_id = b.id and bi.pet_id = p_pet_id)
     and not exists (select 1 from public.booking_items bi where bi.booking_id = b.id and bi.pet_id <> p_pet_id);

  return v_client_id;
end;
$$;

revoke execute on function public.set_pet_owner(uuid, uuid, jsonb) from public, anon;
grant  execute on function public.set_pet_owner(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- search_directory: pets without an owner are found too; a contact card without a
-- name shows its phone / e-mail as the title.
-- ---------------------------------------------------------------------------
create or replace function public.search_directory(p_query text, p_limit int default 20)
returns table (kind text, id uuid, client_id uuid, title text, subtitle text, species text)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      -- escape LIKE wildcards in user input (backslash is the default escape)
      replace(replace(replace(public.f_search_norm(trim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') as norm,
      regexp_replace(coalesce(p_query, ''), '\D', '', 'g') as digits
  )
  select * from (
    select 'client'::text, c.id, c.id,
           coalesce(nullif(c.full_name, ''), c.phone_e164, c.email),
           case when nullif(c.full_name, '') is null then coalesce(c.email, '') else coalesce(c.phone_e164, '') end,
           null::text
    from public.clients c, q
    where c.archived_at is null
      and c.anonymized_at is null
      and char_length(q.norm) >= 2
      and (
        public.f_search_norm(coalesce(c.full_name, '')) like '%' || q.norm || '%'
        or public.f_search_norm(coalesce(c.email, '')) like '%' || q.norm || '%'
        or (char_length(q.digits) >= 2 and c.phone_e164 like '%' || q.digits || '%')
      )
    union all
    select 'pet'::text, p.id, p.client_id, p.name,
           coalesce(nullif(c.full_name, ''), c.phone_e164, c.email, ''),
           p.species::text
    from public.pets p
    left join public.clients c on c.id = p.client_id
    cross join q
    where p.archived_at is null
      and (c.id is null or (c.archived_at is null and c.anonymized_at is null))
      and char_length(q.norm) >= 2
      and (
        public.f_search_norm(p.name) like '%' || q.norm || '%'
        or (char_length(q.digits) >= 3 and trim(p_query) ~ '^[0-9 +()-]+$' and c.phone_e164 like '%' || q.digits || '%')
      )
  ) r(kind, id, client_id, title, subtitle, species)
  order by kind desc, title
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

-- anonymize_client needs no change: it sets the placeholder name, so the card still
-- passes clients_has_contact.
comment on column public.clients.full_name is 'Optional: a contact card needs a name, a phone or an e-mail.';
comment on column public.pets.client_id is 'Optional owner / contact card.';
