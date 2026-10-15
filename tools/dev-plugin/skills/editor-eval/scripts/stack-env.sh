# Sourced by the other scripts. Finds the 84000-apps checkout and the infra
# checkout, and reads the named variables from the LOCAL Supabase stack:
#
#   . stack-env.sh API_URL ANON_KEY
#
# Only the named variables are read, so keys don't end up in a transcript.
# Refuses a stack whose API is not on this machine.

repo="${EDITOR_EVAL_REPO:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
if [[ -z "$repo" || ! -d "$repo/apps/web-main-e2e" ]]; then
  echo "Run this from an 84000-apps checkout, or set EDITOR_EVAL_REPO." >&2
  exit 1
fi

infra="${E2E_INFRA_DIR:-}"
if [[ -z "$infra" ]]; then
  # Beside the repo, or beside the workspace when the repo is an issue
  # worktree (<workspace>/workspaces/issues/<id>/repos/84000-apps).
  for dir in "$repo/../infra" "$repo/../../../../../infra"; do
    if [[ -f "$dir/supabase/config.toml" ]]; then infra="$dir"; break; fi
  done
fi
if [[ -z "$infra" ]]; then
  echo "No infra checkout found; set E2E_INFRA_DIR." >&2
  exit 1
fi

if ! status_env="$(cd "$infra" && supabase status -o env 2>/dev/null)"; then
  echo "supabase status failed in $infra; is the local stack running (make start)?" >&2
  exit 1
fi
for name in API_URL "$@"; do
  value="$(sed -n "s/^$name=\"\{0,1\}\([^\"]*\)\"\{0,1\}\$/\1/p" <<<"$status_env")"
  if [[ -z "$value" ]]; then
    echo "supabase status has no $name." >&2
    exit 1
  fi
  printf -v "$name" '%s' "$value"
done
unset status_env

case "$(sed -E 's#^[a-z]+://([^/:]+|\[[^]]*\]).*#\1#' <<<"$API_URL")" in
  127.0.0.1 | localhost | "[::1]") ;;
  *)
    echo "Refusing a non-local Supabase API: $API_URL" >&2
    exit 1
    ;;
esac
