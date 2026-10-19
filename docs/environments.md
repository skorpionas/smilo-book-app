# Environments runbook

Three isolated stacks. Personal data (clients, pets, bookings) exists **only** in Production.
Everything is in the EU: Supabase eu-central-1 (Frankfurt), Vercel functions `fra1`.

| Stack      | Code                         | Database                                                   | URL                                                                        | Badge   |
| ---------- | ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- | ------- |
| Local      | your checkout                | `supabase start` (Docker) + `supabase/seed.sql`            | http://localhost:3000                                                      | `LOCAL` |
| Preview    | every PR / non-`main` branch | **DEV** `smilo-book-app-dev`, ref `gfnrlbpiqdmlkuyhbwde`   | `smilo-book-app-git-<branch>-zbignevs-projects.vercel.app` (protected)     | `DEV`   |
| Production | `main`                       | **PROD** `smilo-book-app-prod`, ref `qxfovtpskynncfkygpzg` | **https://app.smilo.lt** (after DNS) and https://smilo-book-app.vercel.app | none    |

Supabase dashboards: [dev](https://supabase.com/dashboard/project/gfnrlbpiqdmlkuyhbwde) ·
[prod](https://supabase.com/dashboard/project/qxfovtpskynncfkygpzg). Vercel:
[smilo-book-app](https://vercel.com/zbignevs-projects/smilo-book-app). Do **not** change the separate
`smilo-website` project — it serves the salon's public site on `smilo.lt`.

## How the separation is enforced

- **Vercel environment variables** are scoped: Production → PROD Supabase, Preview + Development → DEV Supabase.
- **Build guard** (`lib/app-env.ts`, called from `next.config.ts`): the build fails if
  - a Production build (`VERCEL_ENV=production` or `NEXT_PUBLIC_APP_ENV=production`) is not on the PROD ref,
  - a Preview/Local build is on the PROD ref,
  - `NEXT_PUBLIC_APP_ENV` disagrees with `VERCEL_ENV`.

  A failed build never replaces the live deployment, so a mis-scoped variable cannot leak dev data into
  production or let a preview write to real data.

- **Badge**: every non-production page shows a small amber `DEV` (preview) or `LOCAL` badge top-right.
- **GitHub environments** hold separate credentials: `dev`, `production` (required reviewer), `prod-backup`.
  Each workflow job checks that `SUPABASE_PROJECT_REF` is the expected ref before touching a database.
- **Seed data** (`seed.sql`) is local/CI only. No workflow uses `--include-seed`.

## Environment variables

| Variable                               | Production                                       | Preview                                          | Development (`vercel dev`) |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------------------ | -------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://qxfovtpskynncfkygpzg.supabase.co`       | `https://gfnrlbpiqdmlkuyhbwde.supabase.co`       | same as Preview            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_jp9LeWzaH1I-lJpvjicixw_4ftJ1uTr` | `sb_publishable_Frx8fk86O9lZsRLyyXytFA_UDep2eiz` | same as Preview            |
| `NEXT_PUBLIC_APP_ENV`                  | `production`                                     | `preview`                                        | `local`                    |

Publishable keys are public by design (RLS protects the data). There is no service-role key anywhere.

Error tracking and speed (issue #20), all optional — the app runs without them:

| Variable                 | Where                  | Value                                                                                      |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SENTRY_DSN` | Production + Preview   | DSN of a Sentry project created in the **EU (Frankfurt)** region (`*.ingest.de.sentry.io`) |
| `SENTRY_AUTH_TOKEN`      | Production (sensitive) | Sentry org auth token — uploads source maps at build time, then they are deleted           |
| `SENTRY_ORG`             | Production             | Sentry organisation slug                                                                   |
| `SENTRY_PROJECT`         | Production             | Sentry project slug                                                                        |

Without a DSN Sentry stays off. Events never carry personal data: no user, IP, cookies, headers, request bodies, query
strings or console breadcrumbs (`lib/sentry.ts`). Speed Insights needs no variable: turn it on in Vercel → project →
**Speed Insights → Enable**; it records route paths only.

## Migrations

1. `supabase migration new <name>` locally, test with `pnpm db:reset` + `pnpm db:test`, commit.
2. Merge to `main` → **DB migrations** workflow (`db-deploy.yml`): job `dev` pushes to DEV, then job
   `production` waits for the `production` environment reviewer, runs `db push --dry-run`, then `db push`.
3. Manual run: GitHub → Actions → DB migrations → Run workflow → target `dev` (any branch) or `production`
   (`main` only — the job refuses other branches).

### Testing a PR with migrations before merging

The PR's Vercel preview already uses the DEV database; only its migrations are missing there.

1. Add the label **`db-dev`** to the PR. The `dev` job applies the PR's migrations (main + the PR) to DEV; it runs
   again on every new push while the label is on. Production is never touched.
2. Open the preview link from the PR (Vercel comment) and test the whole flow on DEV data.
3. Merge. The push to `main` finds the migration already on DEV (nothing to do there) and the `production` job
   waits for approval as usual.

Rules, because DEV then runs ahead of `main`:

- **Don't edit a migration after it reached DEV.** `db push` goes by version number only, so the change would never
  be applied. Add a new migration file instead (or reset DEV, below).
- **One PR with migrations on DEV at a time.** A second PR's run fails on the first one's version
  ("remote migration versions not found locally") until that PR is merged.
- **Closing such a PR without merging:** undo its schema changes on DEV (Supabase SQL editor), then mark it
  not applied: `pnpm exec supabase link --project-ref gfnrlbpiqdmlkuyhbwde` and
  `pnpm exec supabase migration repair --status reverted <version>`. Or rebuild DEV from scratch with
  `pnpm exec supabase db reset --linked` (DEV holds only test data; re-create the test login afterwards).

Never edit an applied migration. Both hosted projects record the same versions in
`supabase_migrations.schema_migrations` (PROD was initialised on 2026-10-14 with 20261019080000–080300).

## Backups and restore

- **Supabase Pro** (after upgrade): daily backups, 7 days, restore from Dashboard → Database → Backups.
- **Weekly encrypted dump** (`db-backup.yml`, Mondays 02:17 UTC, also runnable by hand): `supabase db dump`
  (roles, schema, data) of PROD → `tar.gz` → encrypted with `age` to `BACKUP_AGE_PUBLIC_KEY` → kept 30 days as a
  workflow artifact. Only the holder of the private key can read it.

Restore drill (do once before go-live, into the DEV project or a local stack — never over PROD without need):

```bash
# 1. download the artifact from the workflow run, unzip it, then:
age -d -i smilo-backup-key.txt smilo-prod-<stamp>.tar.gz.age | tar -xzf -   # roles.sql schema.sql data.sql
# 2. into the local stack (pnpm db:start first; get the DB URL from `supabase status`):
psql "$DB_URL" -f roles.sql -f schema.sql -c 'SET session_replication_role = replica' -f data.sql
```

Delete the decrypted files afterwards — they contain personal data.

## Owner checklist (in this order)

Values you will need are in the tables above. Tick each step's **Check** before moving on.

### 1. Choose the app address (2 min)

Recommended: **`app.smilo.lt`**. Alternatives: `rezervacijos.smilo.lt`, `booking.smilo.lt`. The rest of this list
uses `app.smilo.lt` — replace it if you choose another. `smilo.lt` and `www.smilo.lt` stay with the website.

### 2. Vercel environment variables — do this BEFORE merging the PR (10 min)

vercel.com → team **Zbignev DEV** → project **smilo-book-app** → **Settings → Environment Variables**.

1. `NEXT_PUBLIC_SUPABASE_URL` (existing): **⋯ → Edit** → untick **Production**, keep **Preview** and
   **Development** → Save. Do the same for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. **Add New** → Key `NEXT_PUBLIC_SUPABASE_URL`, Value `https://qxfovtpskynncfkygpzg.supabase.co`,
   Environments: **Production** only → Save.
3. **Add New** → Key `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, Value `sb_publishable_jp9LeWzaH1I-lJpvjicixw_4ftJ1uTr`,
   **Production** only → Save.
4. **Add New** `NEXT_PUBLIC_APP_ENV` = `production` (Production only); again `preview` (Preview only); again
   `local` (Development only). If a `NEXT_PUBLIC_APP_ENV` already exists for all environments, delete it first.
5. **Settings → Deployment Protection** → Vercel Authentication = **Standard Protection** (previews need a Vercel
   login; production stays public so the owner can log in).

**Check:** the variables list shows two rows each for the Supabase URL/key (Production vs Preview, Development)
and three rows for `NEXT_PUBLIC_APP_ENV`.

### 3. Supabase PROD — database password and Auth (10 min)

[PROD dashboard](https://supabase.com/dashboard/project/qxfovtpskynncfkygpzg):

1. **Project Settings → Database → Reset database password** → Generate → copy it into your password manager
   as "Smilo PROD DB". (Nobody knows the current one: the project was created by Claude.)
2. **Authentication → Sign In / Providers**: **Allow new users to sign up = OFF**. Under **Email**: provider
   **enabled**, _Confirm email_ may stay on, **Minimum password length = 12** → Save.
3. **Authentication → URL Configuration**: Site URL `https://app.smilo.lt` (no redirect URLs needed — the app
   sends no e-mail links).
4. **Authentication → Users → Add user → Create new user**: the owner's e-mail, a password of 12+ characters,
   tick **Auto Confirm User** → Create.

**Check:** Users shows exactly one user; Sign In / Providers shows sign-ups disabled.

### 4. Supabase DEV — Auth for previews (5 min)

[DEV dashboard](https://supabase.com/dashboard/project/gfnrlbpiqdmlkuyhbwde):

1. **Authentication → Sign In / Providers**: sign-ups **OFF**, Email **enabled**, min length **12** (if not done).
2. **Authentication → URL Configuration**: Site URL `http://localhost:3000` (no redirect URLs needed).
3. **Authentication → Users**: keep one _test_ login for previews (not your real password). If real client data was
   typed into the app while production used DEV (before this change), it is still in DEV: re-enter it in PROD (or ask
   Claude to copy it), then delete it from DEV — personal data should live only in PROD.

### 5. Merge the PR (5 min)

On GitHub, open PR **feat/environments**. Wait for CI (two green checks) and the Vercel preview. Open the preview:
an amber **DEV** badge must be visible. Then **Squash and merge**.

**Check:** Vercel → Deployments → the new Production deployment is **Ready**; https://smilo-book-app.vercel.app shows
**no** badge; you can log in with the PROD owner from step 3.4. If the build failed with "Environment check failed",
step 2 is incomplete — fix the variables and **Redeploy**.

### 6. GitHub environments and secrets (15 min)

Supabase access token: [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) →
**Generate new token** (name `github-actions`) → copy once.

GitHub → repo **smilo-book-app → Settings → Environments**:

| Environment   | Secrets                                                                                  | Variable `SUPABASE_PROJECT_REF` | Protection                                                               |
| ------------- | ---------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| `dev`         | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` (DEV password)                           | `gfnrlbpiqdmlkuyhbwde`          | none                                                                     |
| `production`  | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` (PROD password from step 3.1)            | `qxfovtpskynncfkygpzg`          | **Required reviewers** = you; Deployment branches = **Selected: `main`** |
| `prod-backup` | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` (PROD), `BACKUP_AGE_PUBLIC_KEY` (step 7) | `qxfovtpskynncfkygpzg`          | Deployment branches = **Selected: `main`** (no reviewer)                 |

Click the environment → **Add environment secret** / **Add environment variable**. For `production`, tick
**Required reviewers**, add yourself, **Save protection rules**. Create `prod-backup` with **New environment**.

**Check:** Actions → **DB migrations** → Run workflow → target `production` → approve → the log says the remote
database is up to date (PROD already has all four migrations).

### 7. Backup key and first backup (10 min)

On your own computer (install `age`: macOS `brew install age`, Windows `winget install FiloSottile.age`):

```bash
age-keygen -o smilo-backup-key.txt
```

It prints `Public key: age1…`. Copy **only** the `age1…` part (62 characters, no `Public key:`) into the `prod-backup`
secret `BACKUP_AGE_PUBLIC_KEY`. Never paste the file contents: it holds the private key (`AGE-SECRET-KEY-…`). Keep
`smilo-backup-key.txt` (the private key) in your password manager **and** on a USB stick — without it backups are
unreadable, and it must never be uploaded to GitHub.

**Check:** Actions → **DB backup (weekly, encrypted)** → Run workflow → green; the run has an artifact
`smilo-prod-db-…`. Download it and run the decrypt command from "Backups and restore" once.

### 8. Protect `main` (5 min)

GitHub → **Settings → Rules → Rulesets → New branch ruleset**: name `main`, Enforcement **Active**, Target
**Include default branch**; tick **Require a pull request before merging**, **Require status checks to pass** → add
`Lint, types, unit tests` and `DB tests (pgTAP) + E2E`, **Block force pushes** → Create.

### 9. Domain `app.smilo.lt` (15 min + DNS wait)

`smilo.lt` uses **Hostinger** DNS (nameservers `ns1/ns2.dns-parking.com`); the apex already points to Vercel
(`76.76.21.21`) for the website.

1. Vercel → **smilo-book-app → Settings → Domains → Add Domain** → `app.smilo.lt` → **Connect to an
   environment: Production** → Add. (Do not add `smilo.lt` or `www.smilo.lt` here.) Vercel shows the record to
   create — usually **CNAME `app` → `cname.vercel-dns.com`** or a project-specific `…vercel-dns-0xx.com` value;
   use exactly what Vercel shows. If it also asks for a **TXT `_vercel`** record, add that too.
2. Hostinger → **hPanel → Domains → smilo.lt → DNS / Nameservers → DNS records** → Add record:
   Type **CNAME**, Name **`app`**, Points to **the Vercel value**, TTL **3600** → Add record.
   Do **not** edit the existing `@` A record, `www`, MX or TXT/SPF records (website and `info@smilo.lt` e-mail).
   If there is a **CAA** record, also add CAA `@` `0 issue "letsencrypt.org"`.
3. Wait 5–60 min. **Check:** Vercel Domains shows **Valid Configuration** and a certificate; https://app.smilo.lt
   opens the login page with no badge; https://smilo.lt still shows the website.
4. Optional: **Settings → Domains → `smilo-book-app.vercel.app` → Edit → Redirect to `app.smilo.lt`** so there is one
   address.

### 10. Paid plans — by Fri 2026-11-06 (R4)

- **Supabase Pro** (~$25/month): [org billing](https://supabase.com/dashboard/org/gktsnuvaypyagihltqgu/billing) →
  Change plan → Pro. Gives daily backups and no pausing (free projects pause after ~1 week without activity).
  Pro is per organisation and each project adds compute; the included credit roughly covers one small project, so
  DEV adds a few dollars a month. To avoid that, first move DEV to a separate free organisation (DEV project →
  Settings → General → Transfer project). Then turn on **Spend cap**. Check current prices on supabase.com/pricing.
- **Vercel Pro** (~$20/month per member): team **Zbignev DEV → Settings → Billing → Upgrade to Pro**. Hobby is for
  non-commercial use only. Set a spend limit under Billing → Spend Management.

**Check:** both dashboards show Pro; Supabase PROD → Database → Backups lists a daily backup the next day.

### 11. Optional — fixed preview address `dev.smilo.lt`

Previews already get automatic URLs per branch. A fixed alias only helps with a long-lived branch: create branch
`dev`, then Vercel → Domains → Add `dev.smilo.lt` → Connect to environment **Preview**, Git branch `dev`; add
Hostinger CNAME `dev` → Vercel value.

### 12. Forgotten password (no e-mail flow in the app)

The app has one user (the owner), so it has no "Pamiršau slaptažodį" page and sends no e-mails. Signed in, the
password is changed in **Nustatymai → Keisti slaptažodį**. If it is forgotten, set a new one in the PROD
dashboard → **SQL Editor**:

```sql
update auth.users
set encrypted_password = extensions.crypt('NEW-PASSWORD-12+-CHARS', extensions.gen_salt('bf'))
where email = 'owner@example.lt';
```

(or ask Claude to do it). Never delete and re-create the user instead: every row belongs to its user id, and a new
user would not see any of the existing data.
