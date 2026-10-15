-- Pet birth year (optional) + month (optional, needs a year, not in the future)
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(6);

\ir fixture.psql

create temporary table _p as select id from pets limit 1;

select lives_ok($$update pets set birth_year = 2020, birth_month = null where id = (select id from _p)$$,
  'year without month is accepted');
select lives_ok($$update pets set birth_year = 2020, birth_month = 3 where id = (select id from _p)$$,
  'year and month are accepted');
select throws_ok($$update pets set birth_year = null, birth_month = 3 where id = (select id from _p)$$,
  '23514', null, 'month without a year is rejected');
select throws_ok($$update pets set birth_year = 2020, birth_month = 13 where id = (select id from _p)$$,
  '23514', null, 'month outside 1–12 is rejected');
select throws_ok(format($$update pets set birth_year = %s, birth_month = null where id = (select id from _p)$$,
  extract(year from current_date)::int + 1),
  '23514', null, 'a future year is rejected');
select throws_ok($$update pets set birth_year = 1980 where id = (select id from _p)$$,
  '23514', null, 'implausibly old years are rejected');

select * from finish();
rollback;
