#!/usr/bin/env bash
# Builds a SEPARATE scratch database and runs the agreement-expiry / stale-request tests.
#   ./run_local.sh postgresql://postgres@localhost:5432/postgres   (admin URL; creates `lifecycle_scratch`)
# Never run this against the Supabase project.
set -euo pipefail
ADMIN_URL="${1:?usage: run_local.sh <admin-postgres-url>}"
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../../../.." && pwd)"
SCRATCH_URL="${ADMIN_URL%/*}/lifecycle_scratch"
psql "$ADMIN_URL" -X -q -v ON_ERROR_STOP=1 -c 'drop database if exists lifecycle_scratch' -c 'create database lifecycle_scratch'
psql "$SCRATCH_URL" -X -q -v ON_ERROR_STOP=1 -f "$DIR/00_fixture.sql"
psql "$SCRATCH_URL" -X -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/20261107130000_expire_agreements_and_retire_stale_requests.sql"
psql "$SCRATCH_URL" -X -q -v ON_ERROR_STOP=1 -f "$DIR/05_expiry_and_stale_requests.sql"
echo "LIFECYCLE SQL TESTS PASSED"
