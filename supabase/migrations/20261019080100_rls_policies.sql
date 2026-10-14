-- Smilo Book App — row level security (issue #7)
-- Single owner today; every row carries owner_id so staff logins can come later.
-- No policies exist for `anon`, so the publishable key alone reads nothing.

alter table public.groomers      enable row level security;
alter table public.clients       enable row level security;
alter table public.pets          enable row level security;
alter table public.services      enable row level security;
alter table public.bookings      enable row level security;
alter table public.booking_items enable row level security;

-- Defence in depth: anon gets no table privileges at all.
revoke all on public.groomers, public.clients, public.pets, public.services,
              public.bookings, public.booking_items from anon;

-- Top-level tables: owner sees and writes only own rows.
create policy groomers_owner_all on public.groomers for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy clients_owner_all on public.clients for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy services_owner_all on public.services for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Child tables: also require every referenced parent to belong to the owner
-- (foreign keys bypass RLS, so this blocks pointing at another owner's rows).
create policy pets_owner_all on public.pets for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.clients c where c.id = client_id and c.owner_id = (select auth.uid()))
  );

create policy bookings_owner_all on public.bookings for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.groomers g where g.id = groomer_id and g.owner_id = (select auth.uid()))
    and (client_id is null
         or exists (select 1 from public.clients c where c.id = client_id and c.owner_id = (select auth.uid())))
  );

create policy booking_items_owner_all on public.booking_items for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.bookings b where b.id = booking_id and b.owner_id = (select auth.uid()))
  )
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.bookings b where b.id = booking_id and b.owner_id = (select auth.uid()))
    and exists (select 1 from public.pets p     where p.id = pet_id     and p.owner_id = (select auth.uid()))
    and exists (select 1 from public.services s where s.id = service_id and s.owner_id = (select auth.uid()))
  );
