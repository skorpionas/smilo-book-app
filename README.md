# Smilo Book App

Mobile-first booking app for a two-groomer dog and cat salon. Lithuanian UI, one owner login.
Requirements: `claude/requirements-iteration-1.md` in the Smilo Book App project.

**Stack:** Next.js 16 (App Router, TypeScript strict) · Tailwind CSS 4 · Supabase (Postgres + Auth, Frankfurt) ·
next-intl (`lt` only) · zod · date-fns · Vitest · pgTAP · Playwright.

## Getting started

```bash
pnpm install
cp .env.example .env.local
pnpm db:start            # local Supabase in Docker: applies migrations + seed.sql
# paste API URL and publishable key from the output into .env.local
pnpm dev                 # http://localhost:3000
```

Local login (seed data, local only): `owner@smilo.local` / `smilo-dev-password`.

| Command              | What it does                                                      |
| -------------------- | ----------------------------------------------------------------- |
| `pnpm verify`        | lint + typecheck + i18n check + unit tests with coverage          |
| `pnpm test`          | Vitest unit tests (`tests/unit`)                                  |
| `pnpm db:test`       | pgTAP tests (`supabase/tests`) against the local stack            |
| `pnpm db:test:plain` | Same pgTAP tests on a plain Postgres 16 without Docker (fallback) |
| `pnpm test:e2e`      | Playwright, phone (390×844) and desktop                           |
| `pnpm db:reset`      | Re-apply migrations and seed locally                              |
| `pnpm db:types`      | Regenerate `lib/supabase/database.types.ts` from the local DB     |
| `pnpm check:i18n`    | Fails on hard-coded UI text outside `messages/lt.json`            |

## Environments

Full runbook (Vercel, Supabase Auth, DNS, GitHub secrets, backups): [`docs/environments.md`](docs/environments.md).

| Env        | Branch / trigger | Supabase project                                        | App URL                                                            | Badge   |
| ---------- | ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------ | ------- |
| Local      | any              | `supabase start` (Docker) + `seed.sql`                  | http://localhost:3000                                              | `LOCAL` |
| Preview    | every PR/branch  | **dev** `smilo-book-app-dev` · `gfnrlbpiqdmlkuyhbwde`   | `smilo-book-app-git-<branch>-zbignevs-projects.vercel.app`         | `DEV`   |
| Production | `main`           | **prod** `smilo-book-app-prod` · `qxfovtpskynncfkygpzg` | https://app.smilo.lt (once DNS is set) · smilo-book-app.vercel.app | none    |

All projects are in eu-central-1 (Frankfurt); Vercel functions run in `fra1`.
`next.config.ts` fails the build when a production build points at anything but the prod project, or a
preview/local build points at prod (`lib/app-env.ts`).

Migrations: `supabase migration new <name>` → commit → on merge to `main`, `db-deploy.yml` pushes them to dev,
then to production after the `production` environment's reviewer approves. Never edit an applied migration.
`seed.sql` is never pushed to a hosted project. `db-backup.yml` makes a weekly `age`-encrypted dump of prod.

## Where things are

```
app/(auth)/            login (the only public page)
app/(app)/             everything behind login: calendar, upcoming, search, clients, settings, account
proxy.ts               session refresh + auth gate (Next 16 name for middleware)
lib/time.ts            ALL Vilnius ↔ UTC / DST / 15-min grid logic (risk R1)
lib/phone.ts, money.ts E.164 phone normalisation (default LT), "40,00 €" formatting
lib/supabase/          server / browser / proxy clients + generated DB types
lib/actions/           Server Actions
messages/lt.json       every UI string
supabase/migrations/   schema, RLS, RPC functions
supabase/tests/        pgTAP: overlap constraint, RLS, RPC functions
```

## Decisions made while building (week 1)

- **Cache Components off.** Next 16 enables `cacheComponents` in new apps. Every page here shows private,
  per-request data, so we keep request-time rendering and never cache personal data on the server.
- **No service-role key anywhere.** All queries run as the logged-in owner under RLS. RPCs are `security invoker`.
- **RLS also checks parents.** Child rows (pets, bookings, items) may only point at parents owned by the same
  owner, because foreign keys bypass RLS.
- **Overlap rule in one constraint.** Blocks live in `bookings` (`kind = 'block'`), so the single exclusion
  constraint `bookings_no_overlap` stops double-booking and booking over blocked time. Cancelled rows free the
  slot; no-shows keep it.
- **`end <= start` is reported as a check violation (23514)**, not a range error, so the UI can show a clean message.
- **Ambiguous DST hour** (03:00–04:00 on the fall-back day) resolves to winter time. The salon is closed then.
- **Anonymisation** clears the client's name, phone, e-mail, notes, pet notes and booking notes; keeps visit
  dates, services, prices and per-pet visit notes.
- **Search escapes `%` and `_`** typed by the user.
- **Self-hosted fonts only.** Inter (UI) and Source Serif 4 (titles) are served from `app/fonts/` (SIL OFL,
  Latin + Latin Extended); nothing is requested from Google. Design system: `docs/design.md`, live at `/styleguide`.

## Decisions made while building (week 2)

- **No personal data in URLs.** The clients list filters locally in the browser; the Search tab and the booking
  sheet's client picker call Server Actions (POST). Client pages don't put the name in the tab title.
- **Heavy libraries stay on the server.** zod, libphonenumber and date-fns are not shipped to the browser: the
  server sends display-ready values (times, grid rows, formatted phones) and Client Components use the
  dependency-free `lib/clock.ts`. The booking form loads on first tap (`next/dynamic`). Calendar page ≈ 195 KB gzip.
- **One validation schema per form** in `lib/schemas/`, error messages are keys in `messages/lt.json` → `errors.*`.
- **Booking = one RPC call** (`create_booking_with_items`): optional new client + new pets + booking + items in one
  transaction. Overlap (23P01) is turned into "Šis laikas jau užimtas: 10:00–12:00, Maksas" by looking up the
  conflicting booking; a duplicate phone (23505) is shown on the phone field.
- **Groomer order** = calendar column order; reordering renumbers `sort_order` 1…n.
- **Archive, never delete** for services, clients and pets (requirements §13). Archived services can be restored.

## Decisions: working days, week and month views

- **Working days live on the groomer** (`groomers.work_days`, ISO weekdays 1 = Monday … 7 = Sunday, default
  Monday–Saturday, at least one day). The calendar shows a groomer's lane only on those days
  (`lib/schedule.ts`). If something is already booked for her on a day off, the lane still appears and is
  marked "Ne darbo diena" — a booking never disappears from the calendar.
- **Days off warn, they don't block.** The booking form shows a note when the chosen groomer doesn't work
  that day, but saving is allowed (an extra Saturday happens). The database doesn't enforce working days.
- **Three views, one header:** `/calendar` (day), `/calendar/week`, `/calendar/month`, with a Diena · Savaitė ·
  Mėnuo switcher that keeps the date. Week: agenda list on phones/tablets, 7 day columns split into groomer
  lanes on ≥ 1024 px (tap a free slot to book). Month: a Server Component with no client JS — per-groomer
  counts on phones, the first three visits per day on desktop; every day opens the day view.
- Mutations revalidate `/calendar` as a layout so all three views refresh.

- **Pet birth = year + optional month** (`pets.birth_year`, `pets.birth_month`; no day). Owners rarely know the
  exact date. Month requires a year; neither may be in the future. Age shows "6 m." / "5 mėn.", or "iki 1 m."
  when only the current year is known. Existing `birth_date` values were converted (year + month kept).
- **No bookings on past days.** Today (any hour) or later only — checked by the shared zod schema on the server
  (`pastDate`), the date pickers start at today, and past days in the day / week views offer no slots ("+" books
  today). Not a DB constraint, so completing or editing old visits keeps working.
- **Change, cancel, delete** (US-10) in the booking sheet while a booking is `scheduled`: "Keisti datą ar laiką"
  (groomer, date, start, length; overlap still enforced by the DB), "Atšaukti vizitą" (stays in history and in the
  client's Atšaukta counter), "Ištrinti" (for mistakes, removed completely — A6). Blocks can be moved or deleted.
- **Drag and drop to move** (day view and desktop week view), always with a "Perkelti vizitą?" confirmation.
  Mouse: press and drag. Touch: long-press ~0.35 s, then drag (a quick swipe still scrolls). The ghost snaps to
  15 min, turns red ("užimta") over another card and refuses that drop; past days are not drop targets; the
  database still checks overlaps. "Keisti datą ar laiką" in the sheet is the keyboard / no-drag alternative.

## Decisions: finishing visits (US-11)

- **Visits complete themselves.** A `pg_cron` job (`complete-past-bookings`, every 15 min) runs
  `complete_past_bookings()`: every `scheduled` booking whose end time has passed becomes `completed` and each item
  without an actual price gets its planned price. Bookings end on the 15-min grid, so a visit ending at 12:00 shows ✓
  right after 12:00. Blocks and cancelled bookings are left alone. The function is not callable by the app's roles.
- **"Užbaigti vizitą" / "Pataisyti vizitą"** in the booking sheet (visits starting today or earlier) records or
  corrects the result in one RPC (`complete_visit`): Įvykdyta / Neatvyko / Atšaukta, actual price per line (a shared
  service is split per pet like when booking) and notes per pet. No-show and cancelled clear the actual price, so
  money totals only count visits that happened.
