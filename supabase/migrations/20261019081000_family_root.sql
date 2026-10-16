-- Family (account) is the root (owner feedback 2026-10-16):
--
--   family (public.clients)            optional owner contact: name / phone / e-mail
--     ├─ pets                          every pet belongs to exactly one family
--     │    └─ pet_services             a pet's own time and price
--     └─ client_services               family services: one time and price for all
--
-- A family without any contact is fine; it is shown by its pets' names
-- ("Bim, Bom"). This replaces "pet without an owner" (pets.client_id nullable) and
-- the family card named after the pets.

-- 1. A family may have no contact at all
alter table public.clients drop constraint if exists clients_has_contact;
comment on column public.clients.full_name is 'Optional owner name. A family is shown by name, phone, e-mail or its pets.';
comment on table public.clients is 'Family / account: the root of pets, their owner contact and family services.';

-- 2. Every pet without a family gets its own one, then the link is required
do $$
declare
  r record;
  v_id uuid;
begin
  for r in select id, owner_id from public.pets where client_id is null loop
    insert into public.clients (owner_id) values (r.owner_id) returning id into v_id;
    update public.pets set client_id = v_id where id = r.id;
  end loop;
end;
$$;
alter table public.pets alter column client_id set not null;
comment on column public.pets.client_id is 'The family (account) this pet belongs to.';

drop policy pets_owner_all on public.pets;
create policy pets_owner_all on public.pets for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.clients c where c.id = client_id and c.owner_id = (select auth.uid()))
  );

-- 3. How a family is shown: name, else phone, else e-mail, else its pets' names
create or replace function public.client_label(c public.clients)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    nullif(trim(c.full_name), ''),
    c.phone_e164,
    c.email,
    (select string_agg(p.name, ', ' order by p.name) from public.pets p
      where p.client_id = c.id and p.archived_at is null),
    ''
  )
$$;
revoke execute on function public.client_label(public.clients) from public, anon;
grant  execute on function public.client_label(public.clients) to authenticated;

-- 4. Several new pets: always one family (contact optional), never a made-up name
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
begin
  if p_pets is null or jsonb_typeof(p_pets) <> 'array'
     or jsonb_array_length(p_pets) = 0 or jsonb_array_length(p_pets) > 10 then
    raise exception '1–10 pets are required' using errcode = '22023';
  end if;

  if v_client_id is null then
    insert into public.clients (full_name, phone_e164, email)
    values (
      nullif(trim(coalesce(p_new_client ->> 'full_name', '')), ''),
      nullif(coalesce(p_new_client ->> 'phone_e164', ''), ''),
      nullif(coalesce(p_new_client ->> 'email', ''), '')
    )
    returning id into v_client_id;
  end if;

  for v_pet in select value from jsonb_array_elements(p_pets) loop
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

-- 5. Move a pet to another family (existing, or a new one with an optional contact).
--    Upcoming single-pet bookings follow; an emptied family with no contact and no
--    bookings is removed.
create or replace function public.set_pet_owner(p_pet_id uuid, p_client_id uuid default null, p_new_client jsonb default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client_id uuid := p_client_id;
  v_old       uuid;
begin
  select client_id into v_old from public.pets where id = p_pet_id;
  if not found then
    raise exception 'pet not found' using errcode = 'P0002';
  end if;

  if v_client_id is null then
    insert into public.clients (full_name, phone_e164, email)
    values (
      nullif(trim(coalesce(p_new_client ->> 'full_name', '')), ''),
      nullif(coalesce(p_new_client ->> 'phone_e164', ''), ''),
      nullif(coalesce(p_new_client ->> 'email', ''), '')
    )
    returning id into v_client_id;
  end if;

  update public.pets set client_id = v_client_id where id = p_pet_id;

  update public.bookings b
     set client_id = v_client_id
   where b.status = 'scheduled'
     and b.end_at > now()
     and exists (select 1 from public.booking_items bi where bi.booking_id = b.id and bi.pet_id = p_pet_id)
     and not exists (select 1 from public.booking_items bi where bi.booking_id = b.id and bi.pet_id <> p_pet_id);

  delete from public.clients c
   where c.id = v_old
     and c.id <> v_client_id
     and c.full_name is null and c.phone_e164 is null and c.email is null
     and not exists (select 1 from public.pets p where p.client_id = c.id)
     and not exists (select 1 from public.bookings b where b.client_id = c.id);

  return v_client_id;
end;
$$;

-- 6. Search: a family is found by its contact or its pets' names; titles use client_label
create or replace function public.search_directory(p_query text, p_limit int default 20)
returns table (kind text, id uuid, client_id uuid, title text, subtitle text, species text)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      replace(replace(replace(public.f_search_norm(trim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') as norm,
      regexp_replace(coalesce(p_query, ''), '\D', '', 'g') as digits
  )
  select * from (
    select 'client'::text, c.id, c.id,
           public.client_label(c),
           case when c.phone_e164 is not null and nullif(trim(c.full_name), '') is not null then c.phone_e164
                else coalesce(c.email, '') end,
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
    select 'pet'::text, p.id, p.client_id, p.name, public.client_label(c), p.species::text
    from public.pets p
    join public.clients c on c.id = p.client_id
    cross join q
    where p.archived_at is null
      and c.archived_at is null
      and c.anonymized_at is null
      and char_length(q.norm) >= 2
      and (
        public.f_search_norm(p.name) like '%' || q.norm || '%'
        or (char_length(q.digits) >= 3 and trim(p_query) ~ '^[0-9 +()-]+$' and c.phone_e164 like '%' || q.digits || '%')
      )
  ) r(kind, id, client_id, title, subtitle, species)
  order by kind desc, title
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

-- 7. Bookings: brand-new pets without a family get one new family
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

  -- Every pet lives in a family (account). Brand-new pets and no family given:
  -- one new family for all of them, contact optional (added later on its page).
  if v_client_id is null
     and exists (select 1 from jsonb_array_elements(p_items) e where nullif(e ->> 'pet_id', '') is null)
  then
    insert into public.clients default values returning id into v_client_id;
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
