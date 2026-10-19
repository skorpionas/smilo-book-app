-- The client name search can use its trigram index: the index expression must be the
-- one search_directory filters on (f_search_norm(coalesce(full_name, ''))).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(2);

\ir fixture.psql

select has_index('public', 'clients', 'clients_name_trgm_idx', 'client name trigram index exists');

set local enable_seqscan = off;
create temp table plan_lines (line text);
do $$
declare r record;
begin
  for r in execute $q$explain select id from public.clients
                      where public.f_search_norm(coalesce(full_name, '')) like '%rasa%'$q$
  loop
    insert into plan_lines values (r."QUERY PLAN");
  end loop;
end $$;

select ok(
  exists (select 1 from plan_lines where line like '%clients_name_trgm_idx%'),
  'name search filter is served by clients_name_trgm_idx'
);

select * from finish();
rollback;
