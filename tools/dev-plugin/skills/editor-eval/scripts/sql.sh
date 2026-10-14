#!/usr/bin/env bash
# Runs one read-only SQL query against the LOCAL Supabase database and prints
# the result, for evidence in the editor-eval report.
#
#   sql.sh "select label from passages where uuid = '...'"
#
# The connection comes from `supabase status` in the infra checkout
# (E2E_INFRA_DIR, or ../infra beside the repo). Anything that is not on this
# machine is refused, and the session is read-only.
set -euo pipefail

query="${1:?usage: sql.sh \"<select ...>\"}"
repo="$(git rev-parse --show-toplevel)"
infra="${E2E_INFRA_DIR:-}"
if [[ -z "$infra" ]]; then
  for dir in "$repo/../infra" "$repo/../../../../../infra"; do
    if [[ -f "$dir/supabase/config.toml" ]]; then infra="$dir"; break; fi
  done
fi
[[ -n "$infra" ]] || { echo "No infra checkout found; set E2E_INFRA_DIR." >&2; exit 1; }

db_url="$(cd "$infra" && supabase status -o env 2>/dev/null | sed -n 's/^DB_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
[[ -n "$db_url" ]] || { echo "supabase status gave no DB_URL; is the local stack running?" >&2; exit 1; }
host="$(sed -E 's#^[a-z]+://[^@]*@([^:/]+).*#\1#' <<<"$db_url")"
case "$host" in
  127.0.0.1 | localhost | "[::1]") ;;
  *) echo "Refusing a non-local database host: $host" >&2; exit 1 ;;
esac

PGOPTIONS='-c default_transaction_read_only=on' \
  psql "$db_url" -X -v ON_ERROR_STOP=1 --pset=pager=off -c "$query"
