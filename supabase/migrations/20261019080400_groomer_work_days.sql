-- Working days per groomer. The calendar shows a groomer's lane only on these
-- ISO weekdays (1 = Monday … 7 = Sunday). Default: Monday–Saturday (A1).
alter table public.groomers
  add column work_days smallint[] not null default '{1,2,3,4,5,6}',
  add constraint groomers_work_days_valid check (
    work_days <@ '{1,2,3,4,5,6,7}'::smallint[]
    and cardinality(work_days) between 1 and 7
    and array_position(work_days, null) is null
  );

comment on column public.groomers.work_days is
  'ISO weekdays (1 = Monday … 7 = Sunday) the groomer works; the calendar shows her lane only on these days.';
