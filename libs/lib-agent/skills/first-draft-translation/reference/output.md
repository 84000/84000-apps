# Output

Write the draft to local files rather than delivering it only inline in the
conversation, then save them to storage per *Saving to storage* below. The local
files are the deliverables the editor will open; the saved copies are where the
stage's record lives, and what a later session or another machine reads.

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

## Reading the Stage 0 record

Read `toh#_stage0.md` out of storage before drafting, rather than assuming a
local file survived from the session that produced it — Stage 0 may have been
run weeks ago, by someone else, on another machine.

Call `read-session-documents` with the work's `toh`, `stage: stage0`, and
`names: ["toh#_stage0.md"]`. Markdown comes back inline as text. Call it with
just the `toh` to list everything the work has saved, which is also how to find
a collation report if Stage 0 produced one; a `.docx` comes back as a download
URL to fetch rather than as text.

Absent and unreadable are different findings, and the tool distinguishes them
even though both come back as errors. *No document matched* means Stage 0 has
not been saved for this work: stop and run Stage 0, per *Before drafting* in
`SKILL.md`. *Could not read* means the document may well exist and storage
failed to hand it over — report that and stop, without re-deriving Stage 0's
record here. Re-deriving it would discard work that is sitting in storage.

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
convention established in Stage 0. Saved alongside the Word document.

This is the version to diff, to carry into later stages, and to check the
alignment record against — but it is **not** the file translators are expected
to mark up. Substantive revision happens in the `.docx`.

Use markdown footnote syntax (`[^n]` / `[^n]: …`) for notes so the file converts
cleanly to real Word footnotes when the `.docx` is generated.

Its body omits the `folio_uuid` just as the `.docx` body does. The two bodies
are the same text in two formats; they do not diverge in what they show.

## `toh#_stage1_alignment.md` — the companion alignment record

Named for the text (e.g. `toh345_stage1_alignment.md`), saved alongside the
other two. Its contents are specified in `structure.md`.

Markdown only — **no `.docx` mirror**. This is a machine-checkable traceability
record to be scanned, diffed, and filtered, not a document an editor reads
through or marks up, so it deliberately does not follow the
primary-`.docx` / documentation-`.md` convention that the translation itself and
the Stage 0 collation report follow.

It is the only deliverable carrying the `folio_uuid` for each passage, so keep
it complete: a UUID dropped here is lost.

## Saving to storage

Save all three deliverables to storage once the local files are written and
complete.

Call `write-session-documents` with:

| | |
|---|---|
| `toh` | the work's Toh number, e.g. `toh345` |
| `stage` | `stage1` |
| `files` | `toh#_stage1.docx` as `primary` — it is the file the editor revises; `toh#_stage1.md` and `toh#_stage1_alignment.md` as `supporting` |
| `model` | your model name, and its version only if you know it — see below |

Do not pass `manifest.json`. The manifest recording the work, who saved the set,
when, and with what model is written for you, and is refused as an upload
precisely so its identity and timestamp are not yours to assert.

The tool authorizes the writes and returns one `uploadUrl` per file, each valid
for two hours. **It does not carry the bytes** — PUT each file yourself, with
the `contentType` the response gives for that file. This is how the `.docx`
reaches storage; it cannot ride in a tool argument:

```sh
curl -X PUT -H "Content-Type: <contentType>" --data-binary @<file> "<uploadUrl>"
```

That PUT is the session's own HTTP request, which is a capability the policy
tools do not need. It holds in Claude Code, where this skill ships as a plugin
and `curl` is available. In a client where it does not, say the deliverables
could not be saved to storage rather than reporting a save that did not happen.

**The save is not complete until every PUT has succeeded.** The manifest is
written when the URLs are issued, so a file whose upload failed or was skipped
is described by the manifest but absent from storage. Check each response and
report any that failed — and take particular care with the `.docx`, since it is
the deliverable and the one upload that is not plain text.

Re-drafting archives the previous revision of each path rather than destroying
it, so a re-run does not lose the draft it replaces.

On `model`: record the name you know, and omit the version if you do not know it
reliably. Do not guess it, and do not withhold the save over it.
