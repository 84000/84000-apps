---
name: verify
description: Build, launch, and drive the web-editor sandbox app to verify editor changes at runtime.
---

# Verifying web-editor changes

## Launch

- `npx nx dev web-editor` from the repo root. Default port 3000, but other
  apps (web-main on 3000, api-graphql on 3001) are often already running —
  Next auto-increments, so check the startup log for the actual port.
- Log the server to a file (`npx nx dev web-editor > /tmp/web-editor.log 2>&1 &`)
  — nx swallows output when run as a plain background task.
- Fixture-based routes (`/toh251/passages`, `/basic/json`) need no services.
  DB-backed routes (`/stack/[toh]`) need the local Supabase running and
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
  `apps/web-editor/.env.local`. The anon key there has historically been an
  empty string — copy it from `apps/web-main/.env.local` (also local).
  Restart the dev server after env edits; inlined values don't hot-reload
  reliably.

## Drive

- Playwright is NOT in the repo. Install it in the session scratchpad
  (`npm i playwright` + `npx playwright install chromium-headless-shell`)
  and drive `http://localhost:<port>/...`.
- Editors are TipTap: target `.tiptap[contenteditable="true"]`. For the
  passage stack, rows are `[data-stack-passage="<uuid>"]` and the page
  exposes `window.__stackController` (spine, metas, editors, undo depth)
  for assertions — prefer it over nth-row locators, which break when the
  virtualized window shifts.
- Keyboard: `Meta+ArrowUp/Down` for doc start/end is unreliable in headless
  Chromium — set the caret programmatically via
  `controller.getEditor(uuid).commands.focus('start')`.
- The perf HUD (bottom-right, text starts with "passage stack") reports
  keystroke latency / mount cost / mounted count; read it via textContent.

## Before pushing lib-editing changes

- `npx nx build web-main` — its Next build typechecks all of lib-editing's
  sources AND evaluates server bundles (dev-mode web-editor does neither, so
  type errors and SSR import crashes slip through it silently).
- Anything importing y-prosemirror/@tiptap/y-tiptap must stay out of the
  main lib-editing barrel — those imports crash web-main's SSR module
  evaluation (yjs ESM/CJS dual-load). The stack spike lives on the
  `@eightyfourthousand/lib-editing/stack` subpath for this reason.
- `npx nx build web-editor` fails on a PRE-EXISTING JsonComparePage type
  error (ResizablePanelGroup `direction` prop) — not a signal about your
  change.

## Local data

Local Supabase (port 54321/54322) has toh251 (50 passages) and
toh145,toh847 "Jewel Torch" (853 passages). `?repeat=N` on `/stack/[toh]`
multiplies passages in memory for scale tests.
