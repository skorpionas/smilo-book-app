-- Groomer working days (calendar lanes per weekday)
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(6);

\ir fixture.psql

\set gA '''a0000000-0000-4000-8000-00000000000a'''

select is(
  (select work_days from groomers where id = :gA),
  '{1,2,3,4,5,6}'::smallint[],
  'new groomers work Monday–Saturday by default');

select lives_ok(
  format($$update groomers set work_days = '{1,3,5}' where id = %L$$, :gA),
  'a subset of weekdays is accepted');

select lives_ok(
  format($$update groomers set work_days = '{1,2,3,4,5,6,7}' where id = %L$$, :gA),
  'all seven days are accepted');

select throws_ok(
  format($$update groomers set work_days = '{}' where id = %L$$, :gA),
  '23514', null, 'at least one working day is required');

select throws_ok(
  format($$update groomers set work_days = '{0,8}' where id = %L$$, :gA),
  '23514', null, 'weekdays outside 1–7 are rejected');

select throws_ok(
  format($$update groomers set work_days = '{1,null}' where id = %L$$, :gA),
  '23514', null, 'null weekdays are rejected');

select * from finish();
rollback;
