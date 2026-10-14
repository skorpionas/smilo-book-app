-- Smilo Book App — RPC functions
-- All functions are SECURITY INVOKER, so RLS applies exactly as for direct queries.

-- ---------------------------------------------------------------------------
-- create_booking_with_items: client (optional new) + new pets + booking + items
-- in ONE transaction (US-05, US-06, US-07). Overlaps raise 23P01.
--
-- p_items: [{ "pet_id": uuid | null,
--             "new_pet": { "name", "species", "breed"? } | null,
--             "service_id": uuid, "duration_min": int, "planned_price": numeric }]
-- p_new_client: { "full_name", "phone_e164"?, "email"? } (used when p_client_id is null)
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
  end loop;

  return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_price_prefill (US-08): last completed actual price for this pet + service,
-- else the service's default price.
-- ---------------------------------------------------------------------------
create or replace function public.get_price_prefill(p_pet_id uuid, p_service_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
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
-- search_directory (US-14): clients and pets by accent-free name or phone digits.
-- ---------------------------------------------------------------------------
create or replace function public.search_directory(p_query text, p_limit int default 20)
returns table (kind text, id uuid, client_id uuid, title text, subtitle text)
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
    select 'client'::text, c.id, c.id, c.full_name, coalesce(c.phone_e164, '')
    from public.clients c, q
    where c.archived_at is null
      and c.anonymized_at is null
      and char_length(q.norm) >= 2
      and (
        public.f_search_norm(c.full_name) like '%' || q.norm || '%'
        or (char_length(q.digits) >= 2 and c.phone_e164 like '%' || q.digits || '%')
      )
    union all
    select 'pet'::text, p.id, p.client_id, p.name, c.full_name
    from public.pets p
    join public.clients c on c.id = p.client_id, q
    where p.archived_at is null
      and c.anonymized_at is null
      and char_length(q.norm) >= 2
      and public.f_search_norm(p.name) like '%' || q.norm || '%'
  ) r(kind, id, client_id, title, subtitle)
  order by title
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

-- ---------------------------------------------------------------------------
-- anonymize_client (US-17, GDPR erasure). Irreversible.
-- Keeps visit records (dates, services, prices, pet visit notes) without the
-- client's personal data; blocked while the client has future scheduled bookings.
-- ---------------------------------------------------------------------------
create or replace function public.anonymize_client(p_client_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'client not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.bookings
    where client_id = p_client_id and status = 'scheduled' and end_at > now()
  ) then
    raise exception 'client has future bookings' using errcode = 'P0001', hint = 'future_bookings';
  end if;

  update public.clients
     set full_name     = 'Anonimizuotas klientas',
         phone_e164    = null,
         email         = null,
         notes         = '',
         anonymized_at = now(),
         archived_at   = coalesce(archived_at, now())
   where id = p_client_id;

  update public.pets
     set notes = ''
   where client_id = p_client_id;

  update public.bookings
     set notes = ''
   where client_id = p_client_id;
end;
$$;

-- Only logged-in users may call RPCs.
revoke execute on function public.create_booking_with_items(uuid, timestamptz, timestamptz, jsonb, uuid, jsonb, text) from public, anon;
revoke execute on function public.get_price_prefill(uuid, uuid)                                                    from public, anon;
revoke execute on function public.search_directory(text, int)                                                      from public, anon;
revoke execute on function public.anonymize_client(uuid)                                                           from public, anon;

grant execute on function public.create_booking_with_items(uuid, timestamptz, timestamptz, jsonb, uuid, jsonb, text) to authenticated;
grant execute on function public.get_price_prefill(uuid, uuid)                                                    to authenticated;
grant execute on function public.search_directory(text, int)                                                      to authenticated;
grant execute on function public.anonymize_client(uuid)                                                           to authenticated;
