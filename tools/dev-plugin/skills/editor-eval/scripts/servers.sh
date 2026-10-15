#!/usr/bin/env bash
# Starts api-graphql or web-main in dev mode against the LOCAL Supabase stack,
# with the same env the e2e suite gives them (apps/web-main-e2e/
# playwright.config.ts), so judged items can be driven in a browser:
#
#   servers.sh api    # api-graphql on E2E_GRAPHQL_PORT (3805)
#   servers.sh web    # web-main on E2E_WEB_PORT (3804)
#
# Run each in the background and stop it when you are done. Dev mode is
# required: feature flag overrides only apply under `next dev`.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$here/stack-env.sh" ANON_KEY SERVICE_ROLE_KEY

web_port="${E2E_WEB_PORT:-3804}"
graphql_port="${E2E_GRAPHQL_PORT:-3805}"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_URL="$API_URL"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export SUPABASE_SERVICE_KEY="$SERVICE_ROLE_KEY"
export NEXT_PUBLIC_GRAPHQL_URL="http://localhost:$graphql_port/api/graphql"
export NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES="per-passage-docs,translation-hover-cards"

cd "$repo"
case "${1:-}" in
  api) exec npx nx run api-graphql:dev --port="$graphql_port" ;;
  web) exec npx nx run web-main:dev --port="$web_port" ;;
  *)
    echo "usage: servers.sh api|web" >&2
    exit 1
    ;;
esac
