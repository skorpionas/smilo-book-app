-- ---------------------------------------------------------------------------
-- update_booking_with_items: change an existing booking's services (owner feedback
-- 2026-10-19) — another service, another price, one pet ↔ several pets, single
-- rows ↔ one shared service — together with groomer / start / end / notes,
-- in one transaction (all or nothing).
--
--  * Only visits (kind = 'booking') that are `scheduled` or `completed`.
--    A completed visit keeps its status; its actual prices follow the new
--    prices (the owner is correcting what was really done).
--  * Items are replaced. Visit notes are kept per pet (on that pet's first row).
--  * New pets join the booking's family; "remember" saves a pet's own price,
--    exactly like create_booking_with_items.
--  * Overlaps are still stopped by bookings_no_overlap (23P01).
-- ---------------------------------------------------------------------------

create or replace function public.update_booking_with_items(
  p_booking_id uuid,
  p_groomer_id uuid,
  p_start_at   timestamptz,
  p_end_at     timestamptz,
  p_items      jsonb,
  p_notes      text default ''
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
         notes      = coalesce(p_notes, '')
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

comment on function public.update_booking_with_items(uuid, uuid, timestamptz, timestamptz, jsonb, text) is
  'Change a scheduled or completed visit: groomer, time, notes and its services (items replaced in one transaction).';

revoke execute on function public.update_booking_with_items(uuid, uuid, timestamptz, timestamptz, jsonb, text) from public, anon;
grant  execute on function public.update_booking_with_items(uuid, uuid, timestamptz, timestamptz, jsonb, text) to authenticated;
