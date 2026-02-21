#!/bin/bash
#
# Compare schemas between two PostgreSQL databases.
#
# Usage:
#   ./diff_schemas.sh <testing_host> <testing_db> <testing_password> <prod_host> <prod_db> <prod_password>
#
# All databases are accessed as user "dfacadmin".
#
# Example:
#   ./diff_schemas.sh \
#     "dpg-xxx-a.oregon-postgres.render.com" "cwftesting" "testpass" \
#     "dpg-yyy-a.oregon-postgres.render.com" "dfac" "prodpass"
#
# Outputs a diff showing what testing has that production does not (and vice versa).
# Exit code 0 = schemas match, 1 = differences found.

set -euo pipefail

if [ "$#" -ne 6 ]; then
  echo "Usage: $0 <testing_host> <testing_db> <testing_password> <prod_host> <prod_db> <prod_password>"
  exit 2
fi

TESTING_HOST="$1"
TESTING_DB="$2"
TESTING_PASS="$3"
PROD_HOST="$4"
PROD_DB="$5"
PROD_PASS="$6"
DB_USER="dfacadmin"

# Find the newest pg_dump available (Homebrew installs versioned copies)
PGDUMP="pg_dump"
for v in 18 17 16 15; do
  candidate="/opt/homebrew/opt/postgresql@${v}/bin/pg_dump"
  if [ -x "$candidate" ]; then
    PGDUMP="$candidate"
    break
  fi
done
echo "Using: $PGDUMP ($($PGDUMP --version))"

TMPDIR=$(mktemp -d)
TESTING_SCHEMA="$TMPDIR/testing_schema.sql"
PROD_SCHEMA="$TMPDIR/prod_schema.sql"

cleanup() {
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

echo "Dumping testing schema..."
PGPASSWORD="$TESTING_PASS" $PGDUMP --schema-only --no-owner --no-privileges --no-comments \
  --no-tablespaces --no-security-labels \
  -h "$TESTING_HOST" -U "$DB_USER" -d "$TESTING_DB" \
  | sed '/^--/d' \
  | sed '/^SET /d' \
  | sed '/^SELECT pg_catalog/d' \
  | sed '/^$/N;/^\n$/d' \
  > "$TESTING_SCHEMA"

echo "Dumping production schema..."
PGPASSWORD="$PROD_PASS" $PGDUMP --schema-only --no-owner --no-privileges --no-comments \
  --no-tablespaces --no-security-labels \
  -h "$PROD_HOST" -U "$DB_USER" -d "$PROD_DB" \
  | sed '/^--/d' \
  | sed '/^SET /d' \
  | sed '/^SELECT pg_catalog/d' \
  | sed '/^$/N;/^\n$/d' \
  > "$PROD_SCHEMA"

echo ""
echo "=== Schema Diff (testing vs production) ==="
echo "--- = production"
echo "+++ = testing (what prod is missing or differs)"
echo ""

if diff -u "$PROD_SCHEMA" "$TESTING_SCHEMA" \
  --label "PRODUCTION" --label "TESTING"; then
  echo "Schemas are identical!"
  exit 0
else
  echo ""
  echo "Differences found. Review above to see what production needs."
  exit 1
fi
