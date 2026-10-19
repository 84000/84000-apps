---
name: resolve-glossary-instances
description: Add glossary-instance annotations wherever a work's glossary terms appear in its text. Use when an editor wants a work's glossary terms linked in the translation — "link the glossary terms in Toh 145", "add the missing glossary instances", "resolve glossary instances" — most often for a work that has a glossary but no instances yet. Downloads the draft snapshot, finds every use of each term with a bundled script, reports what it will add and what it is unsure of, and writes only after the editor confirms. Adds only; it never changes or removes an existing instance. Needs a shell with Node.
---

# Resolve glossary instances

A glossary instance is a `glossary-instance` annotation over the span of
passage text where a glossary term is used. This skill finds every use of every
term in a work and adds the missing instances. It is exhaustive by design: link
every use, then let the editor remove the senses that are not the term.

It **adds only.** Never update or remove an existing annotation, and never add
one that overlaps an existing glossary instance.

Read `reference/whole-work-analysis/snapshot.md` first: it describes the
snapshot, its freshness line and the `raw/` files the script reads. The
"Unlinked glossary uses" recipe in `reference/whole-work-analysis/recipes.md` is
the analysis this skill automates. The preview rules are in
`reference/passage-editing/preview.md`; how to save the report is in
`reference/session-documents/saving.md`.

## What an instance looks like

The `add-annotation` edit for one use:

```json
{ "op": "add-annotation", "passageUuid": "<passage uuid>", "kind": "glossary-instance", "start": 107, "end": 120, "text": "Samantabhadra", "data": { "glossary": "<term uuid>", "authority": "<authority uuid>" } }
```

`start` and `end` index the passage content **as stored**, `text` is exactly
what they cover, and both `data` fields are required. The script builds these;
do not write them by hand.

House conventions, which the script follows: plurals are inside the span
(`[[arhats]]`), a possessive `’s` is outside it, a hyphenated compound gets
one instance per term, a leading "the" is not included, and an `alt` form links
to its term. Text inside a cited title (`inline-title`) or a `mantra` is not
glossed, and neither are acknowledgment, header and abbreviation passages or the
work's title line (an unlabeled translation passage). Endnotes **are** glossed,
as in published works; their candidates carry the `endnote` flag so the report
can show them apart.

## Workflow

### 1. Download the snapshot

Resolve the work with `resolve-toh`, then call `download-work-snapshot` and
fetch and unpack it with the command it returns, into a new, empty directory.
Note the freshness line. A snapshot that is not `current` is refreshed in the
background, at most every two minutes: wait two minutes and download again,
until the line reads `current`. After three tries, go on with the snapshot you
have and tell the editor which one it is. The script needs
`raw/passages.jsonl`; a snapshot without it is in an older format and is
refreshed the same way.

### 2. Find the candidates

```sh
node "<this skill>/scripts/glossary-instances.mjs" find <snapshot>/<toh> <out>
```

`<this skill>` is the directory this file is in. The script reads
`raw/passages.jsonl`, `raw/glossary.jsonl`, `anchors.tsv` and the files under
`annotations/`, and writes to `<out>`:

- `candidates.jsonl`: one proposed instance per line, with `id`
  (`<passage anchor>:<start>`), `label`, `start`, `end`, `text`, the `term`
  anchor, the `form` that matched, `flags`, and `context` around it;
- `summary.json`: totals, the flag counts, what was skipped and why, and per
  term (`byTerm`) the existing and found counts and its `flags`.

Matching is case-insensitive on whole words, over each term's `en` and `alt`
forms, allowing soft hyphens inside a word and an `s` or `es` plural. Where
matches overlap, the longest wins. Spans that overlap an existing glossary
instance are skipped.

### 3. Review what is flagged

Most candidates are certain. Spend your judgment on these:

| flag          | on        | means                                              | do                                                                 |
| ------------- | --------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| `ambiguous`   | candidate | another term matches the same text (`alsoMatches`) | read the passage and choose the term, or ask                       |
| `foreign`     | candidate | inside transliterated text                         | usually keep; it is a term in its original language                |
| `endnote`     | candidate | in an endnote                                      | keep; endnotes are glossed                                         |
| `common-word` | term      | a plain English word, such as "nature" or "same"   | read a sample of its `context`s; ask whether every use is the term |
| `many-hits`   | term      | more uses than `--many` (default 150)              | spot-check a sample for another sense                              |

Drop a candidate only when it is clearly not the term — part of a name, an
everyday sense in a phrase like "the lord of death". When unsure, it is an ask,
not a drop.

### 4. Report to the editor

Write the report to a local file, `<toh>_glossary-instances.md`, and save it
with `write-session-documents`, stage `glossary-instances`, role `primary`. It
holds:

- the snapshot's freshness line;
- totals: instances to add, terms affected, passages affected, and how many
  are in endnotes;
- a table per term: anchor, English, existing, to add;
- every flagged term and candidate, with its context and your recommendation;
- what was skipped and why, from `summary.json`'s `skipped`.

Then summarize it in the conversation and ask the editor to confirm or adjust.
Decisions live in this conversation, not in a store.

### 5. Record the decisions

Write `<out>/decisions.json`:

```json
{ "dropTerms": ["g-3074e30d"], "drop": ["p-77f13182:65"], "pick": { "p-944e1b2a:146": "g-9e85815c" } }
```

`dropTerms` excludes a term entirely, `drop` excludes candidates by `id`, and
`pick` chooses the term for an ambiguous candidate (`"none"` drops it). An `id`
is the passage anchor and start offset, so decisions carry over to a re-run
unless the passage itself was edited. Then:

```sh
node "<this skill>/scripts/glossary-instances.mjs" ops <out>
```

It writes `ops-001.json`, `ops-002.json`, … each about 50 edits, keeping a
passage's edits together. If it prints `unmatched`, those decisions name a
candidate or term this run did not find, usually because the passage was
edited: find the candidates they meant and decide them again before applying. Keep files small: a dry run returns the full text of
every passage it touches.

### 6. Check the snapshot is still current

Call `download-work-snapshot` again. If the draft has been edited since your
snapshot, wait for the line to read `current` as in step 1, download, run
`find` again into a new directory, copy `decisions.json` into it, and tell the
editor if the counts changed.

### 7. Apply

For each ops file: call `apply-passage-edits` with the work's uuid, the file's
array as `edits`, and `dryRun: true`; check the result; then call it again
without `dryRun`. Do one file at a time.

- An edit whose `text` no longer matches is refused, and the whole call with it:
  the passage changed after the snapshot. Go back to step 6, at most twice;
  after that, stop and tell the editor which files are still unapplied.
- A warning that an identical instance already exists means it was already
  added. That is safe.
- If a result says `applied: "unknown"`, re-read the passages before sending
  anything again.

### 8. Verify and report

Download the snapshot once more. Its `annotations/glossary-instances.tsv` should
hold the instances you added, and `find` should report no remaining candidates
except the ones the editor declined. Tell the editor what landed, per
`reference/passage-editing/preview.md`.
