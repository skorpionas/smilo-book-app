-- Visits complete themselves once they are over (owner feedback 2026-10-16), and
-- "Užbaigti vizitą" corrects the result afterwards (US-11).
--
-- 1. complete_past_bookings(): every booking still `scheduled` whose end time has
--    passed becomes `completed`, and each item without an actual price gets its
--    planned price. pg_cron runs it every 15 minutes; bookings end on the 15-min
--    grid, so a visit ending at 12:00 is marked done at 12:00.
-- 2. complete_visit(): status (completed / no_show / cancelled), actual price and
--    visit notes per item, in one transaction. Also corrects a visit that was
--    auto-completed (e.g. it was really a no-show or the price was different).

-- ---------------------------------------------------------------------------
-- 1. Auto-complete
-- ---------------------------------------------------------------------------

create or replace function public.complete_past_bookings()
returns int
language plpgsql
-- Runs as the caller. pg_cron runs it as the table owner (no RLS), so it covers
-- every owner's bookings; it is not exposed to the app's roles.
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  with done as (
    update public.bookings
       set status = 'completed'
     where kind = 'booking'
       and status = 'scheduled'
       and end_at <= now()
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from done;

  update public.booking_items
     set actual_price = planned_price
   where booking_id = any (v_ids)
     and actual_price is null;

  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

comment on function public.complete_past_bookings() is
  'Marks scheduled bookings whose end time has passed as completed (actual price = planned). Run by pg_cron.';

revoke execute on function public.complete_past_bookings() from public, anon, authenticated;

-- pg_cron is available on Supabase (hosted and `supabase start`); a plain Postgres
-- used for local pgTAP runs may not have it, so the schedule is optional there.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    grant usage on schema cron to postgres;
    -- Same job name = replaces an existing schedule (idempotent).
    perform cron.schedule(
      'complete-past-bookings',
      '*/15 * * * *',
      'select public.complete_past_bookings()'
    );
  else
    raise notice 'pg_cron not available: visits will not complete automatically on this database';
  end if;
end;
$$;

-- Catch up on visits that ended before this migration.
select public.complete_past_bookings();

-- ---------------------------------------------------------------------------
-- 2. Complete / correct a visit (US-11)
-- ---------------------------------------------------------------------------

create or replace function public.complete_visit(
  p_booking_id uuid,
  p_status     public.booking_status,
  p_items      jsonb default '[]'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking   public.bookings;
  v_end_today timestamptz :=
    (((now() at time zone 'Europe/Vilnius')::date + 1)::timestamp) at time zone 'Europe/Vilnius';
  v_item      jsonb;
begin
  if p_status not in ('completed', 'no_show', 'cancelled') then
    raise exception 'status % is not a visit result', p_status using errcode = '22023';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  -- not found (or another owner's: RLS hides it), blocked time, or already cancelled
  if not found or v_booking.kind <> 'booking' or v_booking.status = 'cancelled' then
    raise exception 'booking % cannot be completed', p_booking_id using errcode = 'P0002';
  end if;
  -- only visits that start today or earlier
  if v_booking.start_at >= v_end_today then
    raise exception 'booking % is in the future', p_booking_id using errcode = '22008';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    update public.booking_items
       set actual_price = case
                            when p_status = 'completed'
                              then coalesce((v_item ->> 'actual_price')::numeric, planned_price)
                            else null
                          end,
           visit_notes  = coalesce(v_item ->> 'visit_notes', visit_notes)
     where id = (v_item ->> 'id')::uuid
       and booking_id = p_booking_id;
  end loop;

  -- items not sent keep their notes; prices follow the status
  if p_status = 'completed' then
    update public.booking_items set actual_price = planned_price
     where booking_id = p_booking_id and actual_price is null;
  else
    update public.booking_items set actual_price = null
     where booking_id = p_booking_id and actual_price is not null;
  end if;

  update public.bookings set status = p_status where id = p_booking_id and status <> p_status;
end;
$$;

comment on function public.complete_visit(uuid, public.booking_status, jsonb) is
  'US-11: set a visit''s result (completed / no_show / cancelled), actual prices and visit notes.';

revoke execute on function public.complete_visit(uuid, public.booking_status, jsonb) from public, anon;
grant  execute on function public.complete_visit(uuid, public.booking_status, jsonb) to authenticated;
