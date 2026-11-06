#!/usr/bin/env bash
# Runs the SQL tests against a SCRATCH PostgreSQL (never the Supabase project).
#   ./run_local.sh postgresql://postgres@localhost:5432/scratch            # tests 01-03 only (any DB)
#   WITH_FIXTURE=1 ./run_local.sh postgresql://postgres@localhost/scratch  # also fixture/10-12 (DB loaded from fixture/local_fixture.sql)
set -euo pipefail
URL="${1:?usage: run_local.sh <postgres-url>}"
DIR="$(cd "$(dirname "$0")" && pwd)"
for f in 01_candidates_lockdown 02_phone_guard_structured_data 03_provider_payload_bounds; do
  psql "$URL" -X -q -v ON_ERROR_STOP=1 -f "$DIR/$f.sql"
done
if [ "${WITH_FIXTURE:-0}" = "1" ]; then
  for f in 10_candidates_exploit 11_provider_payload_rpc 12_input_limits; do
    psql "$URL" -X -q -v ON_ERROR_STOP=1 -f "$DIR/fixture/$f.sql"
  done
fi
echo "ALL SQL TESTS PASSED"
