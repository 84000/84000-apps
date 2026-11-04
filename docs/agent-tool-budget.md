# Agent tool budget

An audit of every model-visible tool the studio MCP serves, against the
principles in [`agent-tooling.md`](./agent-tooling.md). Each tool's description
and schema is read into every session before the user types anything, and the
user's Linear and Supabase tools come on top. This doc says what each tool is
for, who names it, and whether it earns its place. It changes no tool; the cuts
it proposes are drafts for the human to approve (DEV-740).

Principles are cited as P1 to P6, the section numbers of `agent-tooling.md`:
P1 tools are general, P2 bulk work follows one pattern, P3 no local database
credentials, P4 extend before adding, P5 write scope follows ownership, P6 the
database enforces write permissions. Every verdict below that is not keep
breaks P4, applied by analogy: P4 names layers, write-tool ops and `eft`, and
the need here is an option on a read or write tool that already exists.

## Summary

| Audience                                  | Model-visible now | After C1 to C7, aliases removed | Also DEV-894, aliases removed |
| ----------------------------------------- | ----------------: | ------------------------------: | ----------------------------: |
| Studio `/mcp`, `editor` and `admin`       |                38 |                              29 |                            28 |
| Studio `/mcp`, `manager` and `translator` |                36 |                              27 |                            27 |
| Studio `/mcp`, `scholar` and `reader`     |                31 |                              24 |                            24 |
| Public endpoint                           |                21 |                              16 |                            16 |

**Current count: 38. Target count: 28** (29 once `apply-shared-edits`, DEV-895,
is added). The target is reached only when the aliases the cuts leave behind
are removed (draft D); until then every cut keeps its old tool registered and
the count stays at 38, or 39 with DEV-894's `apply-work-edits`. The budget is counted at the widest listing, `editor` and
above. The seven cuts below remove 9 tools; DEV-894 removes 1 more. The 38 tools cost
51,730 bytes of tool JSON in `tools/list` (descriptions and input schemas). The
cut tools are 8,409 bytes of that, 16%, before the surviving tools grow a
little to take their options.

The five app-only policy tools (4,024 bytes) are not counted.

## How the list was checked

The list is built from code, not from a session's tool list. `route.ts` in
`apps/web-main/src/app/mcp/` assembles the studio tools per role; `route.ts` in
`apps/api-mcp/src/app/v1/` serves `createReadTools` alone. The factories were
run with stub clients in the same order and the same role gates, behind
`createMcpHandler`, and `tools/list` was requested for each role, on main at
`5b285b88`. The result agrees with "about 38" in DEV-740. A tool is app-only
when `_meta.ui.visibility` lacks `model`; `open-policy-editor` lists both and
is model-visible.

The public endpoint is the api-mcp app. That `mcp.84000.co` points at it is
from DEV-740; the hostname is configured outside this repo and was not checked
here.

Column notes for the tables:

- **Serves**: `S` the studio `/mcp`, `P` the public endpoint.
- **Bytes**: the tool's entry in `tools/list`, as JSON.
- **Named by**: a text match on the tool's name in `libs/lib-agent/skills/`,
  `reference/` and `agents/`, and in `src/lib/instructions.ts` (shown as
  "server instructions"). A match can be a mention that forbids the tool, as
  `library-assistant` does for the write tools. Other tools' descriptions that
  point at a tool are not listed; each follow-up checks for them.
- **Verdict**: keep, or merge into a named tool. No verdict moves a tool to a
  snapshot layer or removes it outright. The work draft layer already carries
  the glossary and bibliography, but only for roles with `editor.read` and not
  for the public endpoint, so a read that serves them stays a tool.

## Model-visible tools

### Read tools (21)

Listed to every role on `/mcp`; the same 21 are the whole public endpoint.

| Tool                            | Serves | Bytes | What it does                                                                                                                       | Named by                                                                                                                                                                                                                                                                             | Verdict                                                                                                                                                          |
| ------------------------------- | ------ | ----: | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get-translation`               | S P    |   578 | Work metadata by UUID or toh: title, description, publication info, catalog numbers.                                               | docx-import, text-analysis-and-retrieval; agent: library-assistant; server instructions                                                                                                                                                                                              | Keep. The entry point; takes over titles and imprint in C3.                                                                                                      |
| `get-passage`                   | S P    |   622 | One passage by passage UUID alone: content, annotations, metadata.                                                                 | ref: passage-editing; agent: library-assistant                                                                                                                                                                                                                                       | Keep. The only read that needs no work UUID; `get-translation-passages` cannot replace it.                                                                       |
| `get-passage-alignments`        | S P    | 2,354 | Stored Tibetan alignment per passage, with folio and volume; paged.                                                                | folio-reference-audit, tibetan-english-passage-alignment; server instructions                                                                                                                                                                                                        | Keep. Cheap Tibetan-only path. `get-translation-passages` `includeAlignments` duplicates it (see Notes).                                                         |
| `get-translation-passages`      | S P    | 2,074 | A page of a work's passages, by cursor or centred on a passage.                                                                    | docx-import, folio-reference-audit, resolve-folio-mentions; agent: library-assistant                                                                                                                                                                                                 | Keep. The main passage reader.                                                                                                                                   |
| `get-translation-folios`        | S P    | 2,952 | Tibetan source folios of a work, by page, folio UUID or cited folio (F.157b).                                                      | copyediting, editorial-review, first-draft-translation, folio-reference-audit, resolve-folio-mentions, text-analysis-and-retrieval, tibetan-english-passage-alignment, tibetan-source-text; agent: library-assistant                                                                 | Keep. Named by the most skills of any tool.                                                                                                                      |
| `search-translation`            | S P    |   684 | Full-text or regex search inside one published work: passages, alignments, bibliography, glossary.                                 | tibetan-english-passage-alignment; ref: whole-work-analysis; agent: library-assistant; server instructions                                                                                                                                                                           | Merge into `search-entities` (C7). Breaks P4 (an option on an existing tool). Callers move to `search-entities` with `workUuid`, and `useRegex` once C7 adds it. |
| `search-entities`               | S P    | 1,789 | Search works, passages, folios, bibliographies, glossary across the library or within one work; `source` picks published or draft. | text-analysis-and-retrieval; agent: library-assistant                                                                                                                                                                                                                                | Keep. Absorbs `search-translation` (C7).                                                                                                                         |
| `get-glossary-term`             | S P    | 1,100 | One glossary term by UUID: names, definition, attestations.                                                                        | copyediting, editorial-review, first-draft-translation; agent: library-assistant                                                                                                                                                                                                     | Keep.                                                                                                                                                            |
| `list-glossary-terms`           | S P    | 1,427 | A work's glossary terms, paged by cursor.                                                                                          | editorial-review, first-draft-translation                                                                                                                                                                                                                                            | Merge into `search-glossary-terms` (C2). Breaks P4. Callers move to `search-glossary-terms` with no `query` and a `cursor`.                                      |
| `search-glossary-terms`         | S P    | 1,374 | Glossary terms of one work matching a name.                                                                                        | editorial-review, first-draft-translation, glossary-by-canon-section, tibetan-english-passage-alignment; agent: library-assistant                                                                                                                                                    | Keep. Absorbs `list-glossary-terms` (C2).                                                                                                                        |
| `get-glossary-instances`        | S P    |   724 | Every glossary instance in a work, sorted by English name.                                                                         | copyediting, editorial-review, first-draft-translation, glossary-by-canon-section, tibetan-english-passage-alignment; agent: library-assistant                                                                                                                                       | Keep. Instances, not terms: a different result from the term tools.                                                                                              |
| `get-bibliography-entry`        | S P    |   616 | One bibliography entry by UUID.                                                                                                    | agent: library-assistant                                                                                                                                                                                                                                                             | Merge into `list-work-bibliographies` (C4). Breaks P4. Callers (only the library-assistant agent) move to `list-work-bibliographies` with `entryUuid`.           |
| `list-work-bibliographies`      | S P    |   420 | A work's bibliography entries, grouped by heading.                                                                                 | agent: library-assistant                                                                                                                                                                                                                                                             | Keep. Absorbs `get-bibliography-entry` (C4).                                                                                                                     |
| `get-imprint`                   | S P    |   704 | Imprint of a work: publication metadata, license, contributors.                                                                    | text-analysis-and-retrieval                                                                                                                                                                                                                                                          | Merge into `get-translation` (C3). Breaks P4. Callers (text-analysis-and-retrieval) move to `get-translation` with `include: ["imprint"]`.                       |
| `get-toc`                       | S P    |   630 | Table of contents of a work: front matter, body, back matter.                                                                      | docx-import; agent: library-assistant                                                                                                                                                                                                                                                | Keep.                                                                                                                                                            |
| `lookup-entity`                 | S P    |   722 | Reader URL path for a bibliography, glossary term, passage, translation or work.                                                   | folio-reference-audit; agent: library-assistant                                                                                                                                                                                                                                      | Keep. Schema gap noted in Notes.                                                                                                                                 |
| `get-work-titles`               | S P    |   425 | All titles of a work in every language.                                                                                            | text-analysis-and-retrieval                                                                                                                                                                                                                                                          | Merge into `get-translation` (C3). Breaks P4. Callers (text-analysis-and-retrieval) move to `get-translation` with `include: ["titles"]`.                        |
| `search-canon-sections`         | S P    | 1,144 | Find Kangyur or Tengyur sections by name; returns UUID, parent, Toh range.                                                         | glossary-by-canon-section, text-analysis-and-retrieval; agent: library-assistant; server instructions                                                                                                                                                                                | Keep. Must run first and be checked by a person; not merged with the glossary lookup.                                                                            |
| `search-canon-section-glossary` | S P    | 2,117 | How a term is glossed across a canon section, one entry per work.                                                                  | glossary-by-canon-section; agent: library-assistant; server instructions                                                                                                                                                                                                             | Keep. The escalation when a work does not gloss a term; nothing else covers it.                                                                                  |
| `resolve-toh`                   | S P    | 1,372 | Resolve a Toh number to its catalogue entry (superseded, covered, lettered).                                                       | editorial-review, first-draft-translation, folio-reference-audit, kangyur-tengyur-recensions, resolve-folio-mentions, resolve-glossary-instances, text-analysis-and-retrieval, tibetan-english-passage-alignment, tibetan-source-text; agent: library-assistant; server instructions | Keep. Prevents false "missing work" results.                                                                                                                     |
| `transliterate`                 | S P    | 1,393 | Tibetan Unicode to EWTS in the house profile.                                                                                      | editorial-review, tibetan-source-text                                                                                                                                                                                                                                                | Keep. A pure function, but `eft` has no such command and the public endpoint has no shell. Revisit if `eft` gains one.                                           |

### Policy tools (3)

Listed to every role (the `harness.*` checks decide).

| Tool                 | Serves | Bytes | What it does                                                      | Named by                                                                                                                                                                                | Verdict                                                                           |
| -------------------- | ------ | ----: | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `read-policies`      | S      | 1,068 | List or read translation policies, with versions.                 | copyediting, editorial-review, first-draft-translation, policy-authoring, text-analysis-and-retrieval, tibetan-english-passage-alignment; ref: whole-work-analysis; server instructions | Keep. Every skill reads policy live.                                              |
| `write-policy`       | S      | 1,161 | Replace a policy with new markdown, guarded by `expectedVersion`. | policy-authoring; agent: library-assistant; server instructions                                                                                                                         | Keep. Only `policy-authoring` calls it, but chat editing with a diff is its job.  |
| `open-policy-editor` | S      |   925 | Open the policy editor app in the conversation.                   | policy-authoring; server instructions                                                                                                                                                   | Keep. The only model-visible way into the editor app and its five app-only tools. |

### Session documents (2)

Listed to every role.

| Tool                      | Serves | Bytes | What it does                                                     | Named by                                                                                                                                                                                                    | Verdict |
| ------------------------- | ------ | ----: | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `read-session-documents`  | S      | 1,219 | List or read a work's saved stage documents.                     | copyediting, editorial-review, first-draft-translation, text-analysis-and-retrieval, tidy-local-files; ref: session-documents; server instructions                                                          | Keep.   |
| `write-session-documents` | S      | 1,746 | Authorise uploads of a session's documents; returns upload URLs. | copyediting, editorial-review, first-draft-translation, resolve-glossary-instances, text-analysis-and-retrieval; ref: session-documents, whole-work-analysis; agent: library-assistant; server instructions | Keep.   |

### Feedback (3)

Listed to every role.

| Tool                     | Serves | Bytes | What it does                      | Named by                           | Verdict                                                                                           |
| ------------------------ | ------ | ----: | --------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `submit-feature-request` | S      | 1,524 | File a feature request in Linear. | send-feedback; server instructions | Merge into `submit-feedback` (C1). Breaks P4. The `send-feedback` skill passes `kind: "feature"`. |
| `submit-bug-report`      | S      | 1,770 | File a bug report in Linear.      | send-feedback; server instructions | Merge into `submit-feedback` (C1). Breaks P4. The `send-feedback` skill passes `kind: "bug"`.     |
| `submit-feedback`        | S      | 1,376 | File general feedback in Linear.  | send-feedback; server instructions | Keep. Absorbs the other two (C1).                                                                 |

### Profile (2)

Listed to every role.

| Tool              | Serves | Bytes | What it does                                           | Named by                             | Verdict                                         |
| ----------------- | ------ | ----: | ------------------------------------------------------ | ------------------------------------ | ----------------------------------------------- |
| `get-my-profile`  | S      |   558 | The caller's name, role, permissions and profile tags. | onboarding                           | Keep. 558 bytes; the onboarding skill needs it. |
| `add-profile-tag` | S      |   688 | Add a tag to the caller's own profile.                 | onboarding; agent: library-assistant | Keep. 688 bytes; records onboarding done.       |

### Snapshot tools (5)

Listed to `manager` and above (they hold `editor.read`).

| Tool                   | Serves | Bytes | What it does                                                       | Named by                                                                                                                                                                                                | Verdict                                                                                                                                                                             |
| ---------------------- | ------ | ----: | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `work-ls`              | S      |   706 | List a directory of a work's draft snapshot.                       | copyediting, editorial-review; ref: whole-work-analysis; server instructions                                                                                                                            | Merge into `work-read` (C6). Breaks P4. Callers (copyediting, editorial-review, whole-work-analysis) pass a directory path to `work-read`.                                          |
| `work-read`            | S      |   946 | Read a file of the draft snapshot as numbered lines.               | copyediting, editorial-review; ref: whole-work-analysis; server instructions                                                                                                                            | Keep. Absorbs `work-ls` (C6).                                                                                                                                                       |
| `work-grep`            | S      | 1,996 | RE2 search over the whole draft snapshot, ripgrep-style.           | copyediting, editorial-review; ref: whole-work-analysis; server instructions                                                                                                                            | Keep. Covers notes, annotations and Tibetan; `search-translation` is published-only.                                                                                                |
| `download-snapshot`    | S      | 1,862 | Signed URLs to a snapshot archive for local work (P2).             | copyediting, editorial-review, first-draft-translation, kangyur-tengyur-recensions, resolve-glossary-instances, text-analysis-and-retrieval; ref: local-files, whole-work-analysis; server instructions | Keep. The bulk path P2 prescribes. Absorbs `list-snapshot-layers` (C5).                                                                                                             |
| `list-snapshot-layers` | S      |   553 | The layers `download-snapshot` can bundle, with options and sizes. | server instructions                                                                                                                                                                                     | Merge into `download-snapshot` (C5). Breaks P4. No skill names it; callers are the descriptions and server instructions, which move to `download-snapshot` called with no `layers`. |

### Write tools (2)

Listed to `editor` and above.

| Tool                  | Serves | Bytes | What it does                                                    | Named by                                                                                                                  | Verdict                                                                                                                                                                                         |
| --------------------- | ------ | ----: | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apply-entity-import` | S      | 4,296 | Whole-row upserts of titles, metadata and passages into a work. | docx-import; ref: import-model, passage-editing; agent: library-assistant                                                 | Merge into `apply-work-edits` (DEV-894, in progress; not a new cut). Breaks P4. Callers move when DEV-894 updates docx-import and the import-model reference.                                   |
| `apply-passage-edits` | S      | 4,115 | Guarded small edits to a work's passages, with `dryRun`.        | folio-reference-audit, resolve-folio-mentions, resolve-glossary-instances; ref: passage-editing; agent: library-assistant | Merge into `apply-work-edits` (DEV-894, in progress; not a new cut). Breaks P4. Callers move when DEV-894 updates folio-reference-audit, resolve-folio-mentions and resolve-glossary-instances. |

## App-only tools (not counted)

Registered by `createHarnessTools`, with `_meta.ui.visibility: ['app']`. Only
the policy editor app calls them (`apps/policy-editor-mcp-app`), so they sit
outside the budget. They are registered for every role because the stateless
route cannot see whether a client renders MCP Apps, and hosts that ignore
visibility still list them. All are `S` only.

| Tool                   | Bytes | What it does                         | Named by          |
| ---------------------- | ----: | ------------------------------------ | ----------------- |
| `policy-history`       |   629 | Archived revisions of a policy.      | policy editor app |
| `read-policy-revision` |   687 | One archived revision.               | policy editor app |
| `restore-policy`       |   942 | Restore a revision as current.       | policy editor app |
| `delete-policy`        |   822 | Delete a policy, archiving it first. | policy editor app |
| `rename-policy`        |   944 | Rename a policy.                     | policy editor app |

## Proposed cuts

Nine tools go in seven cuts, each a merge, so each is an option on a tool that
stays (P4). None is a removal and none moves a tool into a snapshot layer.

| Cut | Removes                                       | Into                       | Tools saved | Reaches the public endpoint |
| --- | --------------------------------------------- | -------------------------- | ----------: | --------------------------- |
| C1  | `submit-feature-request`, `submit-bug-report` | `submit-feedback`          |           2 | no                          |
| C2  | `list-glossary-terms`                         | `search-glossary-terms`    |           1 | yes                         |
| C3  | `get-work-titles`, `get-imprint`              | `get-translation`          |           2 | yes                         |
| C4  | `get-bibliography-entry`                      | `list-work-bibliographies` |           1 | yes                         |
| C5  | `list-snapshot-layers`                        | `download-snapshot`        |           1 | no                          |
| C6  | `work-ls`                                     | `work-read`                |           1 | no                          |
| C7  | `search-translation`                          | `search-entities`          |           1 | yes                         |

DEV-894 is not a cut here. It adds `apply-work-edits` and keeps the two write
tools as aliases, then removes them in a follow-up; this doc counts the end
state, 2 tools to 1. Nothing here overlaps its scope, and DEV-886's glossary ops
become ops of `apply-work-edits`, not tools.

### What was kept, and why

- **`get-passage`, `get-passage-alignments`**: they look like
  `get-translation-passages` options. `get-passage` is the only read that
  needs no work UUID, and the alignment tool is the cheap Tibetan-only path.
- **`search-canon-sections` and `search-canon-section-glossary`**: two tools,
  one workflow, but the first returns several matches a person must choose
  between, so they cannot be one call.
- **`transliterate`**: the strongest P4 candidate for `eft`, a pure function with
  no data behind it. It stays because the public endpoint and chat clients have
  no `eft`.
- **`write-policy` and `open-policy-editor`**: both edit policy. One edits in
  chat with a diff the user approves, the other opens the app. The skill uses
  the first, and the five app-only tools hang off the second.
- **Profile, session documents, `get-glossary-instances`**: small, and each has
  a skill that depends on it.

## Draft follow-up issues

Each is a draft. The human approves which become Linear issues. Every cut
shares these conditions, not repeated below:

- The old tool names stay registered, with identical input and output shapes,
  until a plugin release has updated the skills. The server deploys separately
  from installed plugins (the reason DEV-894 keeps aliases). Removal is a later
  issue (draft D).
- Skills, `reference/` docs and `src/lib/instructions.ts` that name the old tool
  are updated, and `libs/lib-agent/package.json` is bumped for the plugin
  release (see "Claude Code Plugins" in `CLAUDE.md`). Two open PRs bumping to the
  same version collide, so take the next free one at merge time.
- The merged tool's description stays under the size of the tools it replaces.
- Tests show the old call and the new call return the same content.

**C1. Studio MCP: fold the feedback tools into `submit-feedback`**

Risk: `risk:medium`. The tools are studio-only and a revert restores them.

- `submit-feedback` takes `kind`: `feedback` (default), `bug` or `feature`, and the fields each kind needs; a missing field for the chosen kind is a clear error.
- `submit-bug-report` and `submit-feature-request` stay as aliases.
- The `send-feedback` skill passes `kind`; the feedback section of the server instructions names one tool.
- The Linear issue created for each kind is unchanged: same template, label and duplicate detection.

**C2. MCP: let `search-glossary-terms` list a work's terms**

Risk: `high-risk` by the risk policy: it changes the schema of a tool on the public API (`/v1`), a contract others consume.

- `query` is optional; with none, the tool returns a work's terms, and it takes `cursor` and `direction` as `list-glossary-terms` does.
- `list-glossary-terms` stays as an alias on both endpoints.
- first-draft-translation and editorial-review call the merged tool.
- Check the public endpoint's behavior with no query against the old tool, page for page.

**C3. MCP: add `include` to `get-translation` for titles and imprint**

Risk: `high-risk`, as C2.

- `include` accepts `titles` and `imprint`; the result adds those sections and is unchanged without it.
- `get-work-titles` and `get-imprint` stay as aliases on both endpoints.
- text-analysis-and-retrieval calls `get-translation` with `include`.
- `get-imprint` takes both `uuid` and `toh`; `get-translation` takes exactly one. The issue says what `include: ["imprint"]` returns for a uuid-only call, for a toh-only call, and for a work with several Toh numbers.

**C4. MCP: let `list-work-bibliographies` return one entry**

Risk: `high-risk`, as C2.

- `entryUuid` returns that one entry, as `get-bibliography-entry` does.
- `get-bibliography-entry` stays as an alias on both endpoints.
- `agents/library-assistant.md` names the merged tool.
- `get-bibliography-entry` takes an entry UUID alone, while `list-work-bibliographies` needs the work UUID. The issue confirms the agent always holds the work UUID, or says which callers can no longer be served.

**C5. Studio MCP: fold `list-snapshot-layers` into `download-snapshot`**

Risk: `risk:medium`.

- `download-snapshot` gains a listing mode that returns what `list-snapshot-layers` returns, as a new `dataset` value, not an empty call: today an empty call defaults to `work` and errors. The mode is read-only and issues no download URL.
- `list-snapshot-layers` stays as an alias.
- The descriptions of `download-snapshot` and the server instructions point at the merged call.

**C6. Studio MCP: let `work-read` list a directory**

Risk: `risk:medium`.

- A path that is a directory returns `work-ls`'s listing, with bytes and lines.
- `work-ls` stays as an alias.
- copyediting, editorial-review and `reference/whole-work-analysis` use `work-read` for listings; the instructions name `work-grep` and `work-read`.

**C7. MCP: serve `search-translation` through `search-entities`**

Risk: `high-risk`, as C2, and the least certain cut.

- First compare the two on a sample of works: does `search-entities` with `workUuid` find what `search-translation` finds, and does it return alignments? `search-translation` uses `lib-search`; `search-entities` uses a different path. If the answer is no for alignments or regex, close this issue and keep both.
- Otherwise `search-entities` gains `useRegex` and the alignment fields, and `search-translation` stays as an alias on both endpoints.
- tibetan-english-passage-alignment, `reference/whole-work-analysis`, library-assistant and the read-tool instructions name the merged tool.

**D. MCP: remove the aliases once plugins have released**

Risk: `high-risk`: the removal breaks any client still on the old names.

- Per-tool call counts for the old names (the studio route reports each call to PostHog; the public endpoint reports none, so its callers need another check) show no use in the agreed window.
- The aliases and their tests are removed, with the cuts C1 to C7 and DEV-894 each done and released.
- Server instructions and descriptions no longer name them.

## Notes

These are observations from the audit, not part of any cut.

- **`lookup-entity` and folio UUIDs.** `folio-reference-audit` says to look up
  a folio with `lookup-entity`, and `data-access` resolves `folio`, but the
  tool's `type` enum is bibliography, glossary, passage, translation, work.
  The skill's step cannot run as written. It is a bug for its own issue.
- **`get-translation-passages` `includeAlignments`** returns what
  `get-passage-alignments` returns, and its description sends readers to the
  other tool. A smaller schema is available by dropping the option; not
  proposed, because it changes a tool and callers may rely on it. It defaults to on, so every default page carries alignments and runs to roughly twice the size,
  which is the case for the separate tool.
- **Listing by role.** Policy, feedback, session and profile tools are listed
  to every role, 10 of the 31 tools a `reader` sees, and only some roles can
  use them. A listing gated by permission, not role, would cut a reader's
  context without removing a tool. `route.ts` explains why they follow
  `harness.*` checks, not the role order; the budget counts the widest listing.
- **The public endpoint has no instrumentation**, so there is no call data
  for the four public cuts (C2, C3, C4, C7). Draft D asks for it.
