# Output

Save the draft locally rather than delivering it only inline in the
conversation. The saved files are the deliverables the editor will open.

Both files carry the same title — the source-derived title established in
`structure.md`, not the studio catalog's `mainTitle` — and both contain the full
structure from `structure.md`, in order: Open questions, Summary, Translation
body, Terminology notes, Alignment record.

## `toh#_stage1.docx` — the primary deliverable

Generated via the `docx` skill. Translators and editors review and substantially
revise **this** file directly, so it must carry:

- the full structure from `structure.md`, in the order given there;
- **genuine Word footnotes** for every note, not a numbered endnote list;
- the source Tibetan in the single format chosen for this session;
- the Tibetan/English passage pairs and the Alignment record intact.

Use standard Word styles — no 84000 house template exists for stage-1 body
drafts.

**Set the document's default font to Times New Roman**: the Normal style, body
text, headings, footnotes, and the Terminology and Alignment tables alike,
unless the translator states a different preference for the session.

*Exception:* where the session's Tibetan display format is Unicode (Uchen),
Times New Roman cannot render those glyphs, so leave Tibetan Unicode runs in a
Tibetan-capable font rather than forcing Times New Roman onto them. Extended
Wylie, being Latin script with diacritics, follows the Times New Roman default
like the rest of the document.

Do not leave the document in whatever default font the `docx` skill's template
happens to use.

## `toh#_stage1.md` — the structural system of record

Named for the text (e.g. `toh345_stage1.md`), continuing the stage-numbered
convention established in Stage 0. Saved locally alongside the Word document.

This is the version to diff, to carry into later stages, and to check the
Alignment record against — but it is **not** the file translators are expected
to mark up. Substantive revision happens in the `.docx`.

Use markdown footnote syntax (`[^n]` / `[^n]: …`) for notes so the file converts
cleanly to real Word footnotes when the `.docx` is generated.
