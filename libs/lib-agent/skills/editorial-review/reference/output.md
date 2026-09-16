# Output

Write the report to local files rather than delivering it only inline in the
conversation, then save them to storage per *Saving to storage* below. The local
files are what the editor opens; the saved copies are where the stage's record
lives, and what a later session or another machine reads.

Three files, all carrying the same title — the title of the draft under review,
not a title constructed here:

| | |
|---|---|
| `toh#_stage2.docx` | the primary deliverable; the report the editor and translator read and annotate |
| `toh#_stage2.md` | the structural system of record |
| `toh#_stage2_findings.md` | the machine-scannable index of every item |

The two report files carry the full structure from
`shared-policies/review-report`, in the order given there. The findings index is
a separate record and is **not** a section of either.

## Reading what the work already has

Stage 2 begins by listing what is saved for the work with
`read-session-documents`, then reading the records it depends on.
`reference/session-documents/reading.md` is the mechanism, including the
distinction between a record that is absent and one that could not be read. That
distinction decides different things here than it does at Stage 1:

- **Stage 1 absent** — not on its own a stop. A draft from a human translator or
  team never passed through Stage 1, and reviewing it is the ordinary case. Ask
  the editor for the draft, and record in the report header that the draft did
  not come from storage.
- **Stage 1 unreadable** — stop and say so. The draft probably exists, and
  reviewing a copy the editor pastes in when the saved one is merely unreachable
  risks reviewing a different revision than the one of record.
- **Stage 0 absent** — not a stop either, but a limitation to state in the
  header. Without it you do not have the catalog placement, the witness list, or
  the translator's answers the draft was made under, and findings that turn on
  those must be raised as questions rather than errors.
- **Stage 0 unreadable** — stop and say so, as for Stage 1.

While you are there, note anything else the work has saved. A Stage 0 collation
report bears directly on Tier E: a reading the draft adopted may be a witness
variant the collation already examined.

**Do not re-derive Stage 0's retrieval, catalog and analytics record here.** It
is a different skill's work, and re-deriving it discards findings and translator
answers no rerun will reproduce.

## `toh#_stage2.docx` — the primary deliverable

Generated via the `docx` skill. The editor works through this file and often
passes it to the translator, so it must carry:

- the full structure from `shared-policies/review-report`, in the order given
  there;
- **genuine Word footnotes** for any note the report itself makes, not a
  numbered endnote list;
- the source Tibetan of each quoted reading in the single format chosen for the
  session — ask the editor for Unicode (Uchen) or Extended Wylie, default to
  Unicode, and say in the header which it is and whether it was stated or
  defaulted;
- each item's number, so the global issues list and the cross-reference index
  resolve against the tiers by eye.

Use standard Word styles — no 84000 house template exists for review reports.

Give it the same typographic treatment as the Stage 1 draft and the Stage 0
collation report, so the pipeline's documents read as one family. **Set the
document's default font to Times New Roman** — the Normal style, body text,
headings, footnotes, and the tier tables alike — unless the editor states a
different preference for the session.

*Exception, as at Stages 0 and 1:* Times New Roman cannot render Uchen glyphs, so
leave Tibetan Unicode runs in a Tibetan-capable font rather than forcing Times
New Roman onto them. Extended Wylie, being Latin script with diacritics, follows
the Times New Roman default like the rest of the document.

**Set the point sizes explicitly as well.** The `docx` skill's template leaves
everything at 11pt, which is not what these reports want:

| Run | Size |
|---|---|
| Body text, and the tier tables | 12pt |
| Footnotes | 10pt |
| Quoted Tibetan in **Unicode (Uchen)** | 14pt |
| Quoted Tibetan in **Extended Wylie** | 12pt |

The quoted source readings are what a Tier A or Tier C item turns on, and they
get read glyph by glyph, so the Uchen size matters more here than in running
prose.

## `toh#_stage2.md` — the structural system of record

Named for the text (e.g. `toh345_stage2.md`), continuing the stage-numbered
convention established in Stage 0. Saved alongside the Word document.

This is the version to diff and to carry into later stages — but it is **not**
the file the editor is expected to mark up. That happens in the `.docx`. The two
do not diverge in what they show.

Use markdown footnote syntax (`[^n]` / `[^n]: …`) for notes so the file converts
cleanly to real Word footnotes when the `.docx` is generated.

## `toh#_stage2_findings.md` — the findings index

Named for the text (e.g. `toh345_stage2_findings.md`), saved alongside the other
two. Markdown only — **no `.docx` mirror**. This is a record to be scanned,
sorted and filtered, not prose an editor reads through, so it deliberately does
not follow the primary-`.docx` / documentation-`.md` convention the report
itself follows. It is the same shape of record as the Stage 1 alignment file.

**One row per item, every item, in the same order the tiers give them.** A single
table across all tiers, with these columns:

| Column | |
|---|---|
| Item | the item number, e.g. `A1` — the key that ties the row to its entry in the report |
| Tier | `A`–`E` |
| Section | the section or milestone reference |
| Folio Number | the folio in the primary witness, as a number |
| Folio Side | `a` or `b`, in its own column |
| Line | the line within the folio, where the item has one |
| Folio UUID | the uuid for that folio where the Stage 1 alignment record supplies one; empty for a draft that has no alignment record |
| Confidence | `high`, `moderate` or `query` |
| Summary | one line — what the issue is, not its argument |

Folio number, side and line get **separate columns** rather than a merged
`F.123.a` string, so the file can be sorted and filtered on each independently —
which is also how the ordering rule in `shared-policies/review-report` is
checked mechanically rather than by eye.

An item spanning more than one folio gets one row, anchored at its first folio,
with the remaining folios named in its report entry. An item with no single
anchor is anchored the same way.

The index is derived from the report and must agree with it: same items, same
numbers, same order. If they disagree, the report is the source of truth and the
index is wrong.

## Saving to storage

Save all three deliverables to storage once the local files are written and
complete. Without this the report is only on one machine.

`reference/session-documents/saving.md` is the mechanism, and it is the same for
every stage: the call, the upload URLs and the PUT that carries the bytes, what
happens on a re-run, and what to do when the client cannot make an outbound
request.

What this stage supplies:

| | |
|---|---|
| `stage` | `stage2` |
| `files` | `toh#_stage2.docx` as `primary` — it is the report the editor works from; `toh#_stage2.md` and `toh#_stage2_findings.md` as `supporting` |

The `.docx` is the only upload here that is not plain text, and it is the one the
editor actually opens. Give its PUT particular attention: a Stage 2 that saved
two markdown records and lost the Word document has not saved its deliverable,
however complete the manifest looks.

Before re-reviewing a work, check what is already saved with
`read-session-documents`. A re-run archives rather than destroys, so the earlier
report is recoverable — but *Not this* in `SKILL.md` still asks you to confirm
one is intended.
