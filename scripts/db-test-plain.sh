#!/usr/bin/env bash
# Run migrations + seed + pgTAP tests against a plain Postgres (no Docker).
# Fallback for machines without `supabase start`; CI uses `supabase test db`.
#
# Usage: PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres scripts/db-test-plain.sh
# Requires: psql, and the pgtap, btree_gist, pg_trgm, unaccent, pgcrypto extensions.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${TEST_DB:-smilo_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"

"${PSQL[@]}" -d "$DB" -f "$ROOT/scripts/db/supabase-stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done
echo "seed     seed.sql"
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/seed.sql"

failed=0
for f in "$ROOT"/supabase/tests/*.test.sql; do
  out="$(cd "$ROOT/supabase/tests" && psql -X -d "$DB" -v ON_ERROR_STOP=1 -tA -f "$f" 2>&1)" || failed=1
  if grep -qE '^not ok|# Looks like|ERROR' <<<"$out"; then failed=1; fi
  pass=$(grep -c '^ok' <<<"$out" || true)
  echo "test     $(basename "$f"): ${pass} ok"
  grep -E '^not ok|^#|ERROR' <<<"$out" || true
done

if [[ $failed -ne 0 ]]; then
  echo "DB TESTS FAILED"; exit 1
fi
echo "DB TESTS PASSED"
