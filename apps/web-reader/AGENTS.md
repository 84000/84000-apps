# web-reader — Local Reader

A local stand-in for the public reader (`public-reading-room`), built against the
working tree so reader changes in `lib-editing` can be tried before the libs are
released. Anonymous and read-only, with no sign-in. Not deployed.

## Route Structure

- `/` — redirects to `/translation`
- `/translation` — index of published works
- `/translation/[slug]` — the reader, with parallel routes (`@left`, `@main`, `@right`). A Toh slug (`toh8`) redirects to the work's uuid. Unpublished and unknown works 404
- `/translation/entity/[type]/[slug]` — resolves a passage, glossary, bibliography, folio, work or translation to its place in the reader
- Rewrites (`next.config.js`): `/toh8` → `/translation/toh8`, `/entity/...` → `/translation/entity/...`, as in the public reader

## Running

`npx nx dev web-reader` serves on port 3002. It needs `api-graphql` on 3001 and
a `.env.local` with the Supabase and GraphQL variables (a copy of web-main's
works).

`next.config.js` pins `NEXT_PUBLIC_APPLICATION_NAME` to `web-reader`, so feature
flags scoped to the studio are off here; use `NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES`
to turn one on. Content reads default to `draft`, because the local seed has no
published snapshots; set `NEXT_PUBLIC_CONTENT_SOURCE=published` in `.env.local`
to read what the public reader serves.

## Layout

No session or GraphQL auth providers: server reads use anonymous clients.
