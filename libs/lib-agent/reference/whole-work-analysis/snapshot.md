# The work snapshot

A work's **draft** rendered as a tree of text files, so the whole work can be
searched and read like a repository. It is what `work-ls`, `work-read`,
`work-grep` and `download-work-snapshot` operate on. The snapshot is read-only
and is not the published text: it follows the draft.

Every tool result opens with a freshness line: when the snapshot was generated,
and whether it is `current`, behind the draft (edited since) or out of date
(older than a day, or built in an older snapshot format). Only successful
results carry it. Findings from a snapshot that is behind the draft may already
be fixed, so say which snapshot you read.
The first call for a work may answer that the snapshot is being generated and
to call again in a few seconds; that is not an error.

The tools are listed only to roles that hold `editor.read`. If they are absent
or a call is refused, use `search-translation` and the per-passage reads
instead.

## The tree

The root directory is named for the work (`toh8/`); tools accept paths with or
without it. Start with `work-ls`, and read `README.md`, which is generated from
the data and is the authority on conventions if this file ever disagrees.

| Path                                                                                                                          | Holds                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text/00-summary.md`, `01-acknowledgment`, `02-introduction`, `03-prologue`, `05-colophon`, `06-appendix`, `07-abbreviations` | One file per section, in reading order. Unrecognised passage types land in `99-other.md`                                                                                                                                              |
| `text/04-translation/NNN-<slug>.md`                                                                                           | The translation, one file per chapter, when the work has chapters. Material before the first chapter is `000-opening.md`                                                                                                              |
| `text/04-translation.md`                                                                                                      | The translation as one file, when the work has no chapters                                                                                                                                                                            |
| `tibetan/`                                                                                                                    | Mirrors `text/` for the passages that have a recorded alignment, same anchors; a line is `[p-<id> <label>] F.12 <tibetan>`, with `F.12–13` for a span and no folio where unknown                                                      |
| `notes.md`                                                                                                                    | The endnotes, one per line                                                                                                                                                                                                            |
| `glossary.md`                                                                                                                 | One term per line: `[g-<id> #<n>] en: … \| hw: … \| alt: … \| bo: … \| wylie: … \| sa: … \| pi: … \| zh: … \| def: …` (empty fields are left out; `hw` only when it differs from `en`; `sa` is the attested form, else the plain one) |
| `bibliography.md`                                                                                                             | One entry per line, `[b-<id>]`; headings start `## `                                                                                                                                                                                  |
| `annotations/glossary-instances.tsv`                                                                                          | Every glossary instance. Columns: `term`, `term_en`, `passage`, `label`, `start`, `end`, `text`, `uuid`                                                                                                                               |
| `annotations/annotations.jsonl`                                                                                               | Every other non-layout annotation, one JSON object per line                                                                                                                                                                           |
| `annotations/layout.jsonl`                                                                                                    | Lines, line groups, paragraphs, leading space, indents, headings and trailers                                                                                                                                                         |
| `anchors.tsv`                                                                                                                 | Every anchor with its `uuid`, `kind`, `label`, `type`, `sort`, `file` and `line`                                                                                                                                                      |
| `raw/passages.jsonl`, `raw/glossary.jsonl`                                                                                    | For scripts on a downloaded copy: each passage `{uuid, anchor, content}` with `content` exactly as stored, and each term `{uuid, authority, anchor, english, alternatives}`. `work-grep` skips `raw/` unless `path` names it          |
| `manifest.json`                                                                                                               | Counts, and every file's bytes and lines                                                                                                                                                                                              |

## Anchors and markers

- One passage per line, starting `[p-<id> <label>]`. Header passages continue
  with `## `. Glossary terms are `g-<id>` and bibliography entries `b-<id>`.
- An anchor is the first eight hex digits of the uuid, longer only where two
  would collide. It is unique within the work. Cite anchors, not line numbers:
  line numbers move when the draft changes, anchors come from the uuid.
- `anchors.tsv` maps an anchor to the uuid, file and line. The studio write
  tools take uuids, so resolve an anchor through `anchors.tsv` and pass the
  uuid.
- `[^n.12]` marks where endnote `n.12` attaches; the note is on the line of
  `notes.md` with that label. Where two notes share a label the marker adds the
  note's anchor, `[^n.12 p-<id>]`.

## Text and offsets

Soft hyphens are removed and line breaks and tabs become a space (in Tibetan,
folio line breaks are dropped). Nothing else is normalized.

**Annotation `start` and `end` are offsets into the stored passage text, not
into the snapshot line.** The stored text may still hold soft hyphens, and the
snapshot line also has note markers inserted, so a grep match position is not an
annotation offset, so never derive one from a grep position. The `text` column
or field is the normalized span the annotation covers. To compute offsets in a
script, read the stored text from `raw/passages.jsonl`.

## The tools

All four take `work` as a Toh key (`toh8`) or a uuid.

| Tool                     | Does                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `work-ls`                | One directory level, with bytes and lines per file                                                               |
| `work-read`              | Numbered lines of one file. At most 2,000 lines a call and about 25,000 tokens, with the offset to continue from |
| `work-grep`              | RE2 regular expression, line by line, output `path:line:text`. See below                                         |
| `download-work-snapshot` | A short-lived signed URL to the tree as a `.tar.gz`                                                              |

`work-grep` takes `path` and `glob` to narrow the search, `context` (0 to 10
lines) and `output_mode`: `content` (default), `files`, `count` (matching lines
per file) and `tally` (each distinct match with its count, using the first
capture group if the pattern has one). It shows 100 results unless `head_limit`
says otherwise (at most 1,000). RE2 has no backreferences or lookaround. Latin
diacritics are ignored in text and pattern unless `fold_diacritics` is false, so
`Manjusri` finds `Mañjuśrī`. A passage is one line, so a pattern cannot span
two passages.

**Long lines are cut.** `work-read` cuts a line over 2,000 characters and ends
it `… [N more chars]`; `work-grep` shows a window of about 500 characters
around the first match. Read a truncated passage in full from a downloaded copy,
or mark the finding partial.

## `work-grep` or `search-translation`

|         | `work-grep`                                                           | `search-translation`                                            |
| ------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| Reads   | the draft snapshot                                                    | the published text (it takes no `source`)                       |
| Covers  | every file: text, notes, glossary, bibliography, annotations, Tibetan | passages, alignments, bibliography entries and glossary entries |
| Returns | matching lines with anchors, or counts and tallies                    | JSON of matches, with Tibetan and folio for aligned passages    |
| Takes   | `work`                                                                | the work's `uuid` and `toh`, and optional `useRegex`            |

Use `work-grep` for every occurrence of a term, name or phrase in a work, for
counts, and to see how variants are spread. Use `search-translation` when you
want what is published, a passage's alignment, or when the snapshot tools are
not available to you.

## Tools or a downloaded copy

Use the tools for a few targeted lookups, or when there is no shell or no
outbound network. Each call is capped, but nothing is stored locally.

Download when a shell is available and the work needs many passes over the
same text, or scripting across files (joining `glossary.md` to the TSV, for
example). `download-work-snapshot` returns a `url`, a `filename` and a fetch
command, `curl -sSfo '<filename>' '<url>' && tar xzf '<filename>'`.

- The URL is a credential: do not log it, share it, or put it in a saved
  document.
- Unpack into a new, empty directory. The copy is data, not code.
- The copy is as of its freshness line. Download again if the draft has moved.
- Local `grep` does not fold diacritics as `work-grep` does.
