-- ---------------------------------------------------------------------------
-- Blocked time over several days (owner feedback 2026-10-20): a vacation or a
-- sick leave from the 1st to the 10th is saved in one go.
--
--  * Still one row per day per groomer (the calendar, drag-and-drop and the
--    overlap rules all work per day; one long row would also cover nights).
--  * bookings.block_group links the rows saved together, so the owner can
--    delete the whole period at once. Only blocked time carries it.
--  * No data changes; single-day blocks keep block_group null.
-- ---------------------------------------------------------------------------

alter table public.bookings
  add column block_group uuid,
  add constraint bookings_block_group_only_blocks check (block_group is null or kind = 'block');

comment on column public.bookings.block_group is
  'Blocked-time rows saved together as one period (e.g. a vacation over several days). Null for single blocks and visits.';

create index bookings_block_group_idx
  on public.bookings (block_group)
  where block_group is not null;
