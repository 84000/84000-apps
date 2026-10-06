# Output

Write the deliverables to local files rather than delivering them only inline
in the conversation, then save them to storage per *Saving to storage* below.
The local files are what the copyeditor opens; the saved copies are the record a
later session or another machine reads.

What the files contain, and how an entry is laid out, is
`shared-policies/copyedit-report`. This file is how they are built, checked and
saved.

## The deliverables

| Mode | File | Role |
|---|---|---|
| Tracked revision | `toh#_copyedited_tracked.docx` — the supplied file with tracked changes and comments | `primary` |
| | `toh#_copyedit_review.docx` — the review | `supporting` |
| | `toh#_copyedit_review.md` — the review's markdown text | `supporting` |
| Suggestions report | `toh#_copyedit_review.docx` — the review | `primary` |
| | `toh#_copyedit_review.md` — the review's markdown text | `supporting` |

Name the files for the text (`toh345_copyedit_review.docx`); for a text with two
Toh numbers, join them with a hyphen (`toh773-969_copyedit_review.docx`). A
rerun in the same conversation adds `_run2` before the extension.

The `.docx` and the `.md` of the review carry the same content in the same
order. The `.md` is the version to diff and to read in a later session; the
`.docx` is the one the copyeditor works from.

## Reading what the work already has

Begin by listing what is saved for the work with `read-session-documents`.
`reference/session-documents/reading.md` is the mechanism, including the
distinction between a record that is absent and one that could not be read.

- **A Stage 2 review** (`toh#_stage2.md`) — read it where it exists. A
  suggestions report closes with a short note of how the two relate, and an
  issue the Stage 2 review already raised is not news to the editor. Absent is
  the ordinary case for a text that came through human review; say nothing more
  about it. Unreadable: say so, and say in the note that the relation could not
  be checked.
- **An earlier copyedit** (`copyedit` stage) — if one exists, the text may be at
  a later stage than the editor said; confirm its status before starting, and
  confirm a re-run is intended before saving over it.

**The text to be copyedited is the file the editor supplies**, not a draft
from storage. The Stage 1 draft in storage is pre-editorial and is never the
input here.

## Building the tracked file (mode 1)

Use the `docx` skill's guidance for editing an existing document with tracked
changes and comments. **Work on the supplied file's XML in place** — unpack it,
edit `word/document.xml` and the parts it needs, repack — so that everything
outside the change log survives byte for byte: styles, fields, bookmarks,
section properties, the endnotes. Never rebuild the document from extracted
text.

- **Wording, spelling, punctuation**: `w:del` around the removed run text (as
  `w:delText`) and `w:ins` around the added run, each with `w:author="Claude"`
  and a `w:date`. Split a run only as far as the change requires, and carry the
  run's own `w:rPr` onto both halves.
- **Formatting only**: change the run's `w:rPr` and record the previous
  properties in a `w:rPrChange` with the same author.
- **Comments**: one `w:comment` per query location in `word/comments.xml`,
  author "Claude", opening with its query number (`Q3`, or `Q3 (cont.)`), with
  `w:commentRangeStart`/`w:commentRangeEnd` around the passage and a
  `w:commentReference` run after it. Add the comments part, its relationship
  and its content-type override if the file has none.
- **Never put a comment range or reference inside `word/endnotes.xml`.**
  Anchor it on the note's reference mark in the main text.

### Checks before delivery

All four, every time. A tracked file that fails one is not delivered.

1. **Accept-all gives the corrected text.** Accept every revision in a copy
   (drop `w:del` elements with their content, unwrap `w:ins`, drop
   `w:rPrChange`), extract the text, and compare it with the original text with
   the change log applied. Any difference is a change missing from the log or
   a logged change entered wrongly.
2. **Reject-all gives the original.** Reject every revision in a copy (drop
   `w:ins` with its content, unwrap `w:del` and turn its `w:delText` back into
   `w:t`, restore each `w:rPrChange`), and compare its text and run formatting
   with the supplied file. Any difference is an untracked alteration.
3. **The validator passes** — the `docx` skill's validation script.
4. **It opens in LibreOffice and in Word.** Convert it headless
   (`soffice --headless --convert-to pdf`) and confirm the PDF renders with the
   comments present. If Word is not available to the session, say so when
   delivering; do not report a Word check that was not made.

## The review documents

Generated via the `docx` skill, in standard Word styles — no 84000 template
exists for copyedit reviews. Give them the same typographic treatment as the
other pipeline documents so they read as one family:

| Element | Word rendering |
|---|---|
| Font | Times New Roman throughout — the Normal style, headings, tables and entries |
| Body, tables, entries | 12pt |
| Footnotes | 10pt |
| Title | Title style, one line: *Copyedit review: Toh N, Title* |
| Header table | two columns, no header row, label cell bold, each cell a sentence or two |
| Section headings | Heading 1 for *Suggested Changes*, *Queries* and the other top-level parts; Heading 2 for the five sections under each |
| Change log (mode 1) | a table with a header row: No., Location, Before, After, Rule |
| Sweep table | a table with a header row: Sweep, Scope checked, Result, Entries |
| Mode 2 entry | the first line a Normal paragraph with the number and tags in one bold run and the location after it in regular weight; the Reading, Suggested revision, Description and Rule lines one paragraph each, labels bold, indented 720 DXA; consecutive entries separated by a thin top border on the entry's first paragraph, none after a heading |

In the `.md`, the same layout: `---` between consecutive entries, the fields as
a blockquote under the entry's first line, labels in bold.

**Page references** in either mode are to the supplied file as rendered to PDF
by LibreOffice (`soffice --headless --convert-to pdf`), and the header says so:
Word may paginate a page differently, which is why the paragraph, folio, note or
glossary entry comes first in every location.

**Before saving, sweep both review files**: every Reading quoted exactly as the
file has it; typographer's quotation marks throughout; in Wylie, every _a-chung_
the closing `’` (U+2019), never `'` or `‘`; no entry cited in a table or a
global issue that does not exist under that number.

## Saving to storage

Save the deliverables once the local files are written and checked.
`reference/session-documents/saving.md` is the mechanism — the call, the upload
URLs, the PUT that carries the bytes, what a re-run does, and what to do when
the client cannot make an outbound request.

What this stage supplies:

| | |
|---|---|
| `toh` | the work's Toh number. For a text with two, the first — the filenames carry both |
| `stage` | `copyedit` |
| `files` | per the table in *The deliverables*, with the roles given there |

The `.docx` files are the uploads that matter: the tracked file in mode 1, the
review in mode 2, is what the copyeditor opens. A copyedit that saved its
markdown and lost a Word document has not saved its deliverable, however
complete the manifest looks.
