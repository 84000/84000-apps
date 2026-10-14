#!/usr/bin/env bash
# Runs one SELECT against the LOCAL Supabase database and prints the result,
# for evidence in the editor-eval report.
#
#   sql.sh "select label from passages where uuid = '...'"
#
# It takes a single select, with or show statement, refuses anything that is
# not on this machine, and opens the session read-only. This guards against
# accidents; it is not a security boundary (the connection is the local
# postgres role).
set -euo pipefail

query="${1:?usage: sql.sh \"<select ...>\"}"
trimmed="$(sed -E 's/^[[:space:]]+//; s/[[:space:]]*;?[[:space:]]*$//' <<<"$query")"
if ! grep -qiE '^(select|with|show)[[:space:]]' <<<"$trimmed" ||
  [[ "$trimmed" == *";"* || "$trimmed" == *"\\"* ]]; then
  echo "sql.sh runs one select, with or show statement, without ';' or '\\'." >&2
  exit 1
fi

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$here/stack-env.sh" DB_URL

if [[ "$DB_URL" == *"?"* ]]; then
  echo "Refusing a database URL with parameters: they can redirect the host." >&2
  exit 1
fi
case "$(sed -E 's#^[a-z]+://[^@]*@([^/:]+|\[[^]]*\]).*#\1#' <<<"$DB_URL")" in
  127.0.0.1 | localhost | "[::1]") ;;
  *)
    echo "Refusing a non-local database." >&2
    exit 1
    ;;
esac

env -u PGHOSTADDR -u PGHOST -u PGSERVICE -u PGSERVICEFILE \
  PGOPTIONS='-c default_transaction_read_only=on' \
  psql "$DB_URL" -X -v ON_ERROR_STOP=1 --pset=pager=off -c "$trimmed"
