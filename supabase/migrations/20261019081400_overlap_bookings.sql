-- ---------------------------------------------------------------------------
-- Two visits at the same time for one groomer (owner feedback 2026-10-19):
-- a quick nail trim during a long groom, or two pets of different families
-- groomed together. Still never by accident: the owner confirms each time.
--
--  * bookings.overlap_ok — this visit was saved on top of other visits on
--    purpose. Only visits (never blocked time) can carry it.
--  * bookings_no_overlap now covers rows WITHOUT the flag: two ordinary rows
--    still cannot overlap (23P01), exactly as before.
--  * check_booking_overlap (trigger) covers the rest, also as 23P01:
--      - a flagged visit may overlap other visits, but never blocked time;
--      - an ordinary row (visit or block) may not overlap a flagged visit.
--    So saving any overlapping time without the flag fails, and the app asks
--    "Vis tiek registruoti?" before sending it again with the flag.
--    Checked only when a row is placed (insert, new groomer / time / flag),
--    so finishing or cancelling a visit is never blocked.
--  * create_booking_with_items / update_booking_with_items take
--    p_allow_overlap (default false). The signature changes, so both are
--    dropped and created again with their grants.
-- ---------------------------------------------------------------------------

alter table public.bookings
  add column overlap_ok boolean not null default false,
  add constraint bookings_overlap_only_visits check (kind = 'booking' or not overlap_ok);

comment on column public.bookings.overlap_ok is
  'Saved on top of other visits of the same groomer on purpose (confirmed by the owner). Never on blocked time.';

alter table public.bookings drop constraint bookings_no_overlap;
alter table public.bookings
  add constraint bookings_no_overlap
    exclude using gist (groomer_id with =, during with &&)
    where (status <> 'cancelled' and not overlap_ok);

create or replace function public.check_booking_overlap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- NEW.during (a generated column) is not computed yet in a BEFORE trigger.
  v_during tstzrange;
begin
  if new.status = 'cancelled' or new.end_at <= new.start_at then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.groomer_id = old.groomer_id
     and new.start_at   = old.start_at
     and new.end_at     = old.end_at
     and new.overlap_ok = old.overlap_ok
     and old.status    <> 'cancelled'
  then
    return new; -- not moved: status / notes / items changes are never blocked
  end if;

  -- One placement at a time per groomer, so two saves cannot both pass the check.
  perform pg_advisory_xact_lock(hashtextextended('smilo.booking.' || new.groomer_id::text, 0));
  v_during := tstzrange(new.start_at, new.end_at, '[)');

  if exists (
    select 1
    from public.bookings b
    where b.groomer_id = new.groomer_id
      and b.id <> new.id
      and b.status <> 'cancelled'
      and b.during && v_during
      and case when new.overlap_ok then b.kind = 'block' else b.overlap_ok end
  ) then
    raise exception 'booking overlaps another booking of this groomer'
      using errcode = '23P01', constraint = 'bookings_no_overlap';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_booking_overlap() from public, anon;
grant  execute on function public.check_booking_overlap() to authenticated;

create trigger bookings_check_overlap
  before insert or update on public.bookings
  for each row execute function public.check_booking_overlap();

drop function public.create_booking_with_items(uuid, timestamptz, timestamptz, jsonb, uuid, jsonb, text);
drop function public.update_booking_with_items(uuid, uuid, timestamptz, timestamptz, jsonb, text);

create or replace function public.create_booking_with_items(
  p_groomer_id  uuid,
  p_start_at    timestamptz,
  p_end_at      timestamptz,
  p_items       jsonb,
  p_client_id   uuid  default null,
  p_new_client  jsonb default null,
  p_notes       text  default '',
  p_allow_overlap boolean default false
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

  insert into public.bookings (kind, groomer_id, client_id, start_at, end_at, notes, overlap_ok)
  values ('booking', p_groomer_id, v_client_id, p_start_at, p_end_at, coalesce(p_notes, ''),
          coalesce(p_allow_overlap, false))
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

create or replace function public.update_booking_with_items(
  p_booking_id uuid,
  p_groomer_id uuid,
  p_start_at   timestamptz,
  p_end_at     timestamptz,
  p_items      jsonb,
  p_notes      text default '',
  p_allow_overlap boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_item    jsonb;
  v_pos     int;
  v_pet_id  uuid;
  v_notes   jsonb;
  v_done    uuid[] := '{}';
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'at least one booking item is required' using errcode = '22023';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  -- not found (or another owner's: RLS hides it), blocked time, cancelled or no-show
  if not found or v_booking.kind <> 'booking' or v_booking.status not in ('scheduled', 'completed') then
    raise exception 'booking % cannot be changed', p_booking_id using errcode = 'P0002';
  end if;

  -- Visit notes written so far, per pet.
  select coalesce(jsonb_object_agg(pet_id, notes), '{}') into v_notes
  from (
    select pet_id, string_agg(visit_notes, E'\n' order by position) as notes
    from public.booking_items
    where booking_id = p_booking_id and visit_notes <> ''
    group by pet_id
  ) n;

  update public.bookings
     set groomer_id = p_groomer_id,
         start_at   = p_start_at,
         end_at     = p_end_at,
         notes      = coalesce(p_notes, ''),
         overlap_ok = coalesce(p_allow_overlap, false)
   where id = p_booking_id;

  delete from public.booking_items where booking_id = p_booking_id;

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
        v_booking.client_id,
        trim(v_item -> 'new_pet' ->> 'name'),
        (v_item -> 'new_pet' ->> 'species')::public.pet_species,
        coalesce(trim(v_item -> 'new_pet' ->> 'breed'), '')
      )
      returning id into v_pet_id;
    end if;

    insert into public.booking_items (
      booking_id, pet_id, service_id, duration_min, planned_price, actual_price, visit_notes, position, shared_group
    )
    values (
      p_booking_id,
      v_pet_id,
      (v_item ->> 'service_id')::uuid,
      (v_item ->> 'duration_min')::int,
      (v_item ->> 'planned_price')::numeric,
      case when v_booking.status = 'completed' then (v_item ->> 'planned_price')::numeric end,
      case when v_pet_id = any (v_done) then '' else coalesce(v_notes ->> v_pet_id::text, '') end,
      v_pos,
      nullif(v_item ->> 'shared_group', '')::smallint
    );
    v_done := v_done || v_pet_id;

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

  return p_booking_id;
end;
$$;

comment on function public.update_booking_with_items(uuid, uuid, timestamptz, timestamptz, jsonb, text, boolean) is
  'Change a scheduled or completed visit: groomer, time, notes and its services (items replaced in one transaction).';

revoke execute on function public.create_booking_with_items(uuid, timestamptz, timestamptz, jsonb, uuid, jsonb, text, boolean) from public, anon;
grant  execute on function public.create_booking_with_items(uuid, timestamptz, timestamptz, jsonb, uuid, jsonb, text, boolean) to authenticated;
revoke execute on function public.update_booking_with_items(uuid, uuid, timestamptz, timestamptz, jsonb, text, boolean) from public, anon;
grant  execute on function public.update_booking_with_items(uuid, uuid, timestamptz, timestamptz, jsonb, text, boolean) to authenticated;
