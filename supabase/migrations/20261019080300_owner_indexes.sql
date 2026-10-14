-- Cover owner_id foreign keys flagged by the Supabase performance advisor.
create index pets_owner_idx          on public.pets (owner_id);
create index booking_items_owner_idx on public.booking_items (owner_id);
