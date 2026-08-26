# Output

Save the draft locally rather than delivering it only inline in the
conversation. The saved files are the deliverables the editor will open.

Three files, all carrying the same title — the source-derived title established
in `structure.md`, not the studio catalog's `mainTitle`:

| | |
|---|---|
| `toh#_stage1.docx` | the primary deliverable; the file the editor revises |
| `toh#_stage1.md` | the structural system of record |
| `toh#_stage1_alignment.md` | the companion alignment record |

The two translation files carry the full structure from `structure.md`, in
order: Open questions, Summary, Translation body, Terminology notes. The
alignment record is a separate report and is **not** a section of either.

## `toh#_stage1.docx` — the primary deliverable

Generated via the `docx` skill. Translators and editors review and substantially
revise **this** file directly, so it must carry:

- the full structure from `structure.md`, in the order given there;
- **genuine Word footnotes** for every note, not a numbered endnote list;
- the source Tibetan in the single format chosen for this session;
- the Tibetan/English passage pairs intact, with no `folio_uuid` printed in
  the body.

Use standard Word styles — no 84000 house template exists for stage-1 body
drafts.

**Set the document's default font to Times New Roman**: the Normal style, body
text, headings, footnotes, and the Terminology table alike, unless the
translator states a different preference for the session.

*Exception:* where the session's Tibetan display format is Unicode (Uchen),
Times New Roman cannot render those glyphs, so leave Tibetan Unicode runs in a
Tibetan-capable font rather than forcing Times New Roman onto them. Extended
Wylie, being Latin script with diacritics, follows the Times New Roman default
like the rest of the document.

Do not leave the document in whatever default font the `docx` skill's template
happens to use.

**Set the point sizes explicitly as well.** The `docx` skill's template leaves
everything at 11pt, which is not what these drafts want:

| Run | Size |
|---|---|
| Body text — English, and the Terminology table | 12pt |
| Footnotes | 10pt |
| Source Tibetan, where the session format is **Unicode (Uchen)** | 14pt |
| Source Tibetan, where the session format is **Extended Wylie** | 12pt |

Uchen carries far more stacked detail per glyph than Latin script and needs the
extra size to stay legible at reading distance; Wylie is Latin script and sits
at the body size with everything else. Headings take their size from the Word
heading style's own scale off the 12pt body rather than a fixed value.

## `toh#_stage1.md` — the structural system of record

Named for the text (e.g. `toh345_stage1.md`), continuing the stage-numbered
convention established in Stage 0. Saved locally alongside the Word document.

This is the version to diff, to carry into later stages, and to check the
alignment record against — but it is **not** the file translators are expected
to mark up. Substantive revision happens in the `.docx`.

Use markdown footnote syntax (`[^n]` / `[^n]: …`) for notes so the file converts
cleanly to real Word footnotes when the `.docx` is generated.

Its body omits the `folio_uuid` just as the `.docx` body does. The two bodies
are the same text in two formats; they do not diverge in what they show.

## `toh#_stage1_alignment.md` — the companion alignment record

Named for the text (e.g. `toh345_stage1_alignment.md`), saved locally alongside
the other two. Its contents are specified in `structure.md`.

Markdown only — **no `.docx` mirror**. This is a machine-checkable traceability
record to be scanned, diffed, and filtered, not a document an editor reads
through or marks up, so it deliberately does not follow the
primary-`.docx` / documentation-`.md` convention that the translation itself and
the Stage 0 collation report follow.

It is the only deliverable carrying the `folio_uuid` for each passage, so keep
it complete: a UUID dropped here is lost.
