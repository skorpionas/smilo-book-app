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

| Env        | Branch           | Database                                              | Deploy                        |
| ---------- | ---------------- | ----------------------------------------------------- | ----------------------------- |
| Local      | feature branches | `supabase start` + `seed.sql`                         | `pnpm dev`                    |
| Preview    | every PR         | **dev** project `gfnrlbpiqdmlkuyhbwde` (eu-central-1) | Vercel preview (to set up)    |
| Production | `main`           | **prod** project (not created yet)                    | Vercel production (to set up) |

Migrations: `supabase migration new <name>` → commit → `db-deploy.yml` pushes them to dev on merge to `main`;
production is a manual run gated by the `production` GitHub environment. Never edit an applied migration.
`seed.sql` is never pushed to a hosted project.

## Where things are

```
app/(auth)/            login, forgot-password (public)
app/(app)/             everything behind login: calendar, upcoming, search, clients, settings, account
app/auth/confirm/      password-reset e-mail link handler
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
- **No web fonts.** System font stack: nothing to download, nothing sent to Google.
