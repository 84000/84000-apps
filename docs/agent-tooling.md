# Agent tooling principles

How agent-facing features are built in this repo, so that the studio MCP
(`libs/lib-agent/src/lib/tools/`), the `eft` CLI (`apps/cli`) and the skills
(`libs/lib-agent/skills/`) grow the same way. Read this before adding a tool, a
CLI command or a skill that reads or writes studio data.

The tools that exist today are audited against these principles in
[`agent-tool-budget.md`](./agent-tool-budget.md).

The short version: the MCP stays small and general, task-specific logic lives in
skills and `eft`, and nothing outside the server holds database credentials.

## 1. MCP tools are general

A tool reads or writes entities: a passage, a glossary term, a bibliography
entry. A need that is specific to one task is not a tool. It becomes a snapshot
layer, an `eft` command or a skill.

Example: linking a work's glossary terms in its text is one workflow. It has no
tool of its own. The `resolve-glossary-instances` skill
(`libs/lib-agent/skills/resolve-glossary-instances/`) does the finding in a
bundled script, `scripts/glossary-instances.mjs`, and writes with the general
`apply-passage-edits` tool, as ordinary `add-annotation` edits of kind
`glossary-instance`.

## 2. Bulk work follows one pattern

1. **Download** the data with `download-snapshot`, as one or more layers.
2. **Process locally**, with `eft` or a script bundled in a skill. The script
   reads the unpacked files and writes proposed edits to local files.
3. **Write back** with a general write tool, a small batch at a time.

A write tool for this pattern offers a dry run, and guards each write with the
state the processing was based on, so a write fails rather than landing on data
that has since changed. `apply-passage-edits` does both, as below.

Example: `resolve-glossary-instances` runs `glossary-instances.mjs find`, then
`ops`, which writes `ops-001.json`, `ops-002.json` and so on, about 50 edits
each. For each file it calls `apply-passage-edits` with `dryRun: true`, checks
the result, then calls it again to write. It re-downloads the snapshot first
to confirm the draft has not moved. The tool's guard is the `text` field of
`delete-text` and `add-annotation`
(`libs/lib-agent/src/lib/tools/write/apply-passage-edits.ts`): the offsets came
from the snapshot, `text` is what they covered then, and an edit whose text is
not there is refused, and the whole call with it. `text` is optional on
`add-annotation`, so a script that reads offsets from a snapshot must always
send it, as `glossary-instances.mjs` does. The guard catches most stale edits,
not all, so the skill re-downloads the snapshot before it applies.

## 3. Nothing local needs database credentials

A skill, an `eft` command or a script bundled with a skill never reads a
Supabase key, and its instructions never ask the user for one. The service role
stays on the server. Local code gets data through the MCP, using the user's own
login.

Example: the snapshot layers are built on a `service_role` client inside
`apps/api-graphql` (see `apps/api-graphql/src/graphql/schema/snapshot/bundle.resolver.ts`), but only after
the caller's own permission for each layer was checked; the layer declares it
as `permission` (`work-draft.ts` requires `editor.read`; a layer's
`permissionFor` can lower that for a request, such as a published source). The skill downloads
the result through `download-snapshot` and never sees the key.

`apps/node-scripts` also holds a service-role key (see its README). It is
operator tooling for the publishing pipeline, run by staff on a trusted
machine. It is not a model for skills, which run on editors' computers.

## 4. Extend before adding

Before adding a tool, check whether one of these serves the need, in this
order:

1. A field or option on an existing **snapshot layer**.
2. A new **op** or option on an existing **write tool**.
3. A new **layer** (register it in
   `libs/lib-publishing/src/lib/layers/default-registry.ts`).
4. An **`eft`** command or a **skill script** that processes what is already
   downloaded.

A new tool needs a reason the existing ones cannot serve, written in the PR. Every
tool is another description an agent must read and choose between.

Example: `apply-passage-edits` is one tool with four ops (`delete-text`,
`add-annotation`, `remove-annotation`, `insert-passage`). Adding a
glossary-instance, a mention or an end-note link needed no new tool: each is an
`add-annotation` with a different `kind` and `data`. Likewise `work.draft`,
`work.folios` and the other work layers are values of the `layer` field of one
`download-snapshot` tool, not tools of their own.

## 5. Write scope follows ownership

A write tool is scoped by who owns the rows it changes, and each scope needs a
different permission.

- **`apply-work-edits`** (planned, DEV-894) covers what one work owns. It needs
  `editor.edit`. It may create shared rows, such as a new authority, but never
  changes a row that other works use.
- **`apply-shared-edits`** (planned, DEV-895) changes shared entities, such as
  authorities and names several works share. It needs `editor.admin`.

Today `apply-passage-edits` (`editor.edit`) and `apply-entity-import` are the
shipped write tools. `apply-passage-edits` is the model for the work scope: it
takes one `workUuid` and edits that work's passages.

If a change to a shared row is needed while editing a work, do not widen the
work-scoped tool. Report it, so that someone with `editor.admin` can make it
through the shared-scope tool.

## 6. The database enforces write permissions, through save functions

A tool's own permission check (`hasPermission` in the handler) is a courtesy
that gives a clear error. The database is the authority. A write reaches
Postgres through a save function that applies a whole planned change in one
transaction, and the permission is enforced there or by the table policies the
function runs under. Do not open a table's write policy so that a user-token
write will pass: that grants the permission to every client of the table, not
to the tool.

Example: `commitSave` (`libs/data-access/src/lib/passage/save/commit.ts`) writes
through `apply_passage_save`, which applies passage, label and annotation
changes, then deletes, in one transaction per call (a large import may be
chunked), and raises, rolling everything back, if a statement touches fewer
rows than planned. That count matters because RLS silently filters a blocked
`UPDATE` or `DELETE` instead of raising. The function runs as the caller
(`SECURITY INVOKER`), so the `authorize('editor.edit')` row policies on the
tables decide, and the function itself checks no permission. The bibliography save, `apply_bibliography_save`, is built the
same way. A write that changes shared rows is the case where `editor.edit`
policies are not enough. Either the shared tables' write policies already
require `editor.admin` (the `titles` table does), or the write goes through a
function that calls `authorize('editor.admin')` itself and is the only path to
those rows. Check which holds before relying on it, and do not loosen the
policies to make the write pass.

Functions and policies live in the `infra` repo, as migrations.

## Checklist for a new agent feature

- Can a snapshot layer, an existing tool op or a skill script do it? Then do
  that (principles 1 and 4).
- Does it move many rows? Download, process locally, write back with a dry run
  and a guard (principle 2).
- Does anything that runs on a user's machine need a key? Redesign (principle 3).
- Which rows does a write change, and who owns them? Choose the scope and its
  permission (principle 5), and make the database enforce it (principle 6).

Skills and their scripts ship in the plugins, with the next release bump of
`libs/lib-agent/package.json`. Do not publish changed content under an
already-published version (see "Claude Code Plugins" in `CLAUDE.md`).
