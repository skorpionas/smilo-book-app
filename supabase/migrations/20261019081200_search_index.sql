-- Client name search index never matched the query (Supabase advisor: unused index).
-- search_directory filters on f_search_norm(coalesce(full_name, '')) since full_name
-- became optional (20261019080700_client_optional), but the index was built on
-- f_search_norm(full_name). An expression index is only used for the same expression.

drop index if exists public.clients_name_trgm_idx;
create index clients_name_trgm_idx
  on public.clients using gin (public.f_search_norm(coalesce(full_name, '')) extensions.gin_trgm_ops);
