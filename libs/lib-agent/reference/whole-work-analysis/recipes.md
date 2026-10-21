# Recipes for whole-work analysis

Each recipe reads the snapshot (`snapshot.md` in this directory) and reports
findings. None of them edits the work. Findings cite passage anchors, with the
passage label for a reader.

## Terminology consistency

For one term, or a set of epithets and formulae, find every rendering used.

1. Find the term's entry in `glossary.md` (`work-grep` for the term, with
   `path: glossary.md`; results stop at 100 unless `head_limit` is raised) for
   its `en` and `alt` forms. The snapshot glossary is the work's own; the binding
   house rendering is what `shared-policies/terminology` says.
2. Tally the renderings: `work-grep` with `output_mode: tally`, `path: text`,
   case-insensitive, and a capture group over the variants, such as
   `(bodhisattvas?|bodhi-beings?)`. Counts show which is the norm.
3. List where each outlier is: `output_mode: content` on that variant, or
   `count` for the spread by chapter file.
4. For a source-side check, grep `tibetan/` for the Tibetan term. The same
   anchors lead the lines in `text/`, so the English renderings of one Tibetan
   term can be compared passage by passage. `tibetan/` holds only aligned
   passages.
5. Before calling an outlier a finding, read its passage and the endnotes
   attached to it (`work-read`, `notes.md`): a note may document the variation.

Report counts per rendering and an anchor for each deviation.

## Unlinked glossary uses

Analysis only: find where a glossary term is used in the text without a
glossary-instance annotation. This recipe writes nothing.

1. Take the terms from `glossary.md`: `en`, and `alt` for variants.
2. Take the linked uses from `annotations/glossary-instances.tsv`: one row per
   instance, with the term's `g-` anchor, the passage anchor and the covered
   `text`.
3. For each term, `work-grep` its forms in `text/` (case-insensitive, with word
   boundaries and a plural allowance) and compare, per passage, with its rows
   in the TSV. A passage with more hits than rows has candidates.
4. Read each candidate in context. Drop other senses and parts of longer words.
   Report the rest with passage anchor, term anchor and the sentence, marking
   the uncertain ones.

The TSV `start` and `end` are stored-text offsets (see `snapshot.md`): do not
compute them from grep positions.

## Chapter-by-chapter review across sub-agents

For a work too long to review in one context. Chapters are independent; checks
that span the work are not.

1. `work-ls` on `text/04-translation` lists the chapter files with their
   lines. A work without chapters is one file, `text/04-translation.md`:
   split it by line range with `work-read`'s `offset` and `limit`. Add the
   other `text/` sections, `notes.md` and the bibliography as units of their own.
2. Launch one sub-agent per chapter, or per group of short ones, within the
   concurrency the session allows. Each brief names the work, the chapter's
   file and its `tibetan/` counterpart if it exists, the checks to run, and the policies to
   read with `read-policies`. A sub-agent does not share your context, so
   do not paraphrase the policies.
3. Ask each for findings only, one per line, in a form you can merge:
   `anchor | category | what the text says | the issue`, citing anchors and
   never line numbers.
4. Run the whole-work checks yourself, over the full snapshot: terminology and
   epithet consistency, cross-references and front matter against body. A
   chapter agent cannot see the rest of the work.
5. Merge the findings in reading order, remove duplicates, and apply the
   stage's report structure (`shared-policies/review-report` or
   `shared-policies/copyedit-report`).

**Save the findings to session documents.** One agent saves, and it is you.
Write each chapter's findings to a local file with a distinct flat name, such as
`toh345_stage2_ch03_findings.md`, in `84000/scratch/<toh>/<stage>-chapters/`,
and the merged report with the stage's deliverables
(`reference/local-files/layout.md`). Use the
stage of the task (`stage2` for editorial review, `copyedit` for copyediting)
and do not reuse a filename the stage's policies already assign. Then save with
`write-session-documents`; see `reference/session-documents/saving.md`. Say
which snapshot (freshness line) the review read.
