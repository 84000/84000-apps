# Output

Write the draft to local files rather than delivering it only inline in the
conversation, then save them to storage per *Saving to storage* below. The local
files are the deliverables the editor will open; the saved copies are where the
stage's record lives, and what a later session or another machine reads.

Two files, both carrying the same title — the title established in
`structure.md`, not the studio catalog's `mainTitle` — and the same structure,
in order: header block, Open questions, Summary, Translation body, Terminology
notes.

| | Whole-text draft | Range draft |
|---|---|---|
| The primary deliverable; the file the editor revises | `toh#_stage1.docx` | `toh#_stage1_F12a-F20b.docx` |
| The structural system of record | `toh#_stage1.md` | `toh#_stage1_F12a-F20b.md` |

**A range draft's filenames carry its folio range**: the first and last folio
sides of the range as given in the request, each written as `F`, the folio
number and the side letter with no dots, joined by a hyphen —
`toh345_stage1_F12a-F20b.md`. Consecutive or separate range drafts of one work
are then saved side by side rather than replacing one another.

## Reading the Stage 0 record

Stage 1 begins by reading `toh#_stage0.md` out of storage. Do not assume a local
file survived from the session that produced it — Stage 0 may have been run weeks
ago, by someone else, on another machine. `reference/session-documents/reading.md`
is the mechanism, including the distinction between a record that is absent and
one that could not be read.

For this stage that distinction decides between two different stops:

- **Stage 0 absent** — stop and run Stage 0 first, per *Before drafting* in
  `SKILL.md`.
- **Stage 0 unreadable** — stop and say so. The record probably exists.

Either way, **do not re-derive Stage 0's retrieval, catalog, and analytics
record here.** It is a different skill's work, and re-deriving it discards
findings and translator answers that Stage 0 gathered and that no rerun will
reproduce.

While you are there, list what else the work has saved. A collation report from
Stage 0 bears directly on the drafting decisions this stage makes, and it is not
mentioned in `toh#_stage0.md` beyond a link and a headline finding.

## Reading earlier Stage 1 drafts

List what is saved under `stage1` for the work with `read-session-documents`.
Any whole-text or range draft already there matters to this one in two ways.

**Overlap.** If a saved draft covers any part of this draft's scope, tell the
translator and confirm before drafting, per _Scope_ in `SKILL.md`. Saving under
an existing filename archives the earlier draft.

**Terminology.** Read the `.md` of each saved draft — its renderings in the
body and its Terminology Notes — before drafting, and render the same source
term the same way here, so that a work drafted in ranges stays one-to-one
consistent across them, per `shared-policies/terminology`. Two limits:

- An earlier Stage 1 rendering is a consistency precedent, **not a binding
  house rendering**. Where an entry located through the glossary route in
  `shared-policies/terminology` differs from it, the located entry binds; use
  it, and record the divergence from the earlier draft in Open questions.
- The saved drafts are the drafts as Stage 1 produced them, not the
  translator's later revisions of the `.docx`. Ask the translator whether any
  of their renderings have since been changed, and follow the answer.

**The Stok Palace answer.** Note the witness line in each saved draft's
header, and give it when putting the Stok Palace question to the translator,
per `shared-policies/stok-consultation`.

A read that fails is not an absent draft: say so rather than drafting as
though no earlier draft existed.

## The Word document — the primary deliverable

Generated via the `docx` skill. Translators and editors review and substantially
revise **this** file directly, so it must carry:

- the full structure from `structure.md`, in the order given there;
- **genuine Word footnotes** for every note, not a numbered endnote list;
- the English translation body only, with its Degé folio markers — no source
  Tibetan, and no passage numbers.

Use standard Word styles — no 84000 house template exists for stage-1 body
drafts.

**Set the document's default font to Times New Roman**: the Normal style, body
text, headings, footnotes, and the Terminology table alike, unless the
translator states a different preference for the session. Extended Wylie,
being Latin script with diacritics, follows the same default and is set in
italics per `shared-policies/transliteration`. No Tibetan-script font is used
anywhere in the document.

Do not leave the document in whatever default font the `docx` skill's template
happens to use.

**Set the point sizes explicitly as well.** The `docx` skill's template leaves
everything at 11pt, which is not what these drafts want:

| Run | Size |
|---|---|
| Body text — English, and the Terminology table | 12pt |
| Footnotes | 10pt |

Extended Wylie takes the size of the text it stands in. Headings take their size
from the Word heading style's own scale off the 12pt body rather than a fixed
value.

## The markdown record — the structural system of record

Named for the text and scope, as in the table above, continuing the
stage-numbered convention established in Stage 0. Saved alongside the Word
document.

This is the version to diff and to carry into later stages — but it is **not**
the file translators are expected to mark up. Substantive revision happens in
the `.docx`.

Use markdown footnote syntax (`[^n]` / `[^n]: …`) for notes so the file converts
cleanly to real Word footnotes when the `.docx` is generated.

The two bodies are the same text in two formats; they do not diverge in what
they show.

## Before saving

Check both files, and correct anything found, before saving to storage:

- no character from the Tibetan Unicode block (U+0F00–U+0FFF) anywhere — in the
  `.docx`, check the footnotes as well as the body;
- no Tibetan-script font named anywhere in the `.docx`, including its styles and
  font table;
- no passage numbers, no `folio_uuid`, no empty table cells or stray labels,
  and no empty paragraphs other than those IV.H calls for (around a block
  citation, or marking a significant change of subject);
- every folio marker in the form `[F.45.b]`, placed per IV.H;
- every _a-chung_ in the Wylie a `’`, with no `'` or `‘` standing for one, and
  the `’` intact in the `.docx`;
- the header block's scope matching the filenames;
- where the Stok Palace version was consulted: the header's witness line
  present; every Stok variant note giving the D reading, the S reading and the
  S folio, with the sigla D and S and no classification tag; no Stok reading
  adopted in the body; and the Stok Wylie normalized to the house profile, the
  _a-chung_ included — the rKTs eText writes it as a straight apostrophe.

## Saving to storage

Save both deliverables to storage once the local files are written and
complete.

`reference/session-documents/saving.md` is the mechanism, and it is the same for
every stage: the call, the upload URLs and the PUT that carries the bytes, what
happens on a re-run, and what to do when the client cannot make an outbound
request.

What this stage supplies:

| | |
|---|---|
| `stage` | `stage1` |
| `files` | the `.docx` as `primary` — it is the file the editor revises; the `.md` as `supporting` |

The `.docx` is the only upload here that is not plain text, and it is the one the
editor actually opens. Give its PUT particular attention: a Stage 1 that saved
the markdown record and lost the Word document has not saved its deliverable,
however complete the manifest looks.
