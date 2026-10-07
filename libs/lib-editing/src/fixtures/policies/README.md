# Policy fixtures

The corpus for `src/lib/components/editor/markdown/markdown-corpus.spec.ts`,
which round-trips every file through the policy editor's markdown subset and
pins whether it round-trips or, if not, why it falls back to the raw view.

- `seed/` is a copy of `infra/supabase/seed/policies` from the infra repo,
  which this repo's CI cannot see. Keep the two in step: when the seed changes,
  copy it here and update the spec's expectations.
- `synthetic/` holds small policies that exercise the subset: headings,
  emphasis, links, lists, nested lists, quotes and tables, plus one case per
  known reason a policy falls back.

Byte-exact content matters here, so do not run a formatter over these files.

## Running against the production policies

The fixtures are samples. To measure how many real policies fall back, mirror
them into the local stack and point the spec at a dump of the local bucket.
Everything below reads from and writes to the local stack only; the mirror
script is the one step that reads production, and it never writes there.

1. From the infra repo, with the local stack running, mirror the policies into
   the local `translation-harness` bucket:

   ```sh
   cd infra
   supabase seed buckets --local   # once, if the bucket does not exist
   scripts/seed-policies.sh --from-prod
   ```

2. Still in `infra`, dump the local bucket to a directory. This talks to the
   local Storage API with the local service-role key from `supabase status`:

   ```sh
   OUT=/tmp/policy-corpus
   STATUS="$(supabase status -o json)"
   URL="$(printf '%s' "$STATUS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["API_URL"])')"
   KEY="$(printf '%s' "$STATUS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["SERVICE_ROLE_KEY"])')"
   list() {
     curl -sS -X POST "$URL/storage/v1/object/list/translation-harness" \
       -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
       -d "{\"prefix\":\"$1\",\"limit\":1000}"
   }
   for prefix in $(list '' | python3 -c 'import sys,json;[print(e["name"]) for e in json.load(sys.stdin) if e.get("id") is None and e["name"] != "archive"]'); do
     mkdir -p "$OUT/$prefix"
     for name in $(list "$prefix" | python3 -c 'import sys,json;[print(e["name"]) for e in json.load(sys.stdin) if e.get("id") and e["name"].endswith(".md")]'); do
       curl -sS -f -o "$OUT/$prefix/$name" -H "Authorization: Bearer $KEY" \
         "$URL/storage/v1/object/translation-harness/$prefix/$name"
     done
   done
   ```

3. From the 84000-apps root, run the spec against the dump:

   ```sh
   POLICY_CORPUS_DIR=/tmp/policy-corpus \
     npx jest -c libs/lib-editing/jest.config.ts markdown-corpus
   ```

   It prints the total, how many round-trip, how many fall back, and for each
   fallback the first line that changed. It fails only if the guard itself is
   broken, never because a policy falls back.
