-- Pet birth date → birth year (optional) + birth month (optional, only with a year).
-- Owners rarely know the exact day; the age shown is in years (or months for the young).
alter table public.pets
  add column birth_year  smallint,
  add column birth_month smallint;

update public.pets
set birth_year  = extract(year from birth_date)::smallint,
    birth_month = extract(month from birth_date)::smallint
where birth_date is not null;

alter table public.pets
  drop column birth_date,
  add constraint pets_birth_year_valid check (
    birth_year is null or birth_year between 1990 and extract(year from current_date)::int
  ),
  add constraint pets_birth_month_valid check (
    birth_month is null or (birth_year is not null and birth_month between 1 and 12)
  ),
  add constraint pets_birth_not_future check (
    birth_month is null or make_date(birth_year, birth_month, 1) <= current_date
  );

comment on column public.pets.birth_year is 'Year of birth (optional).';
comment on column public.pets.birth_month is 'Month of birth 1–12 (optional, requires birth_year).';
