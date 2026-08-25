# Output

Store the results in a single local markdown document named `toh#_stage0.md` —
`toh345_stage0.md`, for instance — saved locally rather than delivered only
inline in the conversation. This file is what Stage 1 reads before drafting
begins.

## `toh#_stage0.md` — the Stage 0 record

Use this structure, in this order:

1. **Catalog record** — Toh number, title(s) as given in the catalog, canonical
   section, Degé volume and folio range, any duplicate locations, bam po markers
   if noted.
2. **Structural overview** — chapter and section count, prose versus verse
   composition, approximate length, any structural anomalies worth flagging.
3. **Genre and register** — as established in `analytics.md`, marked as
   provisional where applicable.
4. **Precedent translations** — a cited list, or an explicit "none located" if
   that is the finding.
5. **Terminological field** — a short list of the vocabulary domains identified.
6. **Parallel witnesses** — what is known to exist, with the source noted for
   each item. If a collation report was produced, **link to it here** rather
   than duplicating its table in this document; one or two sentences on the
   headline finding — how many substantive variants, and whether any change the
   recommended translation — is enough.
7. **Translator input** — the answers gathered when soliciting translator input.
8. **Open questions** — anything that could not be established mechanically and
   needs the translator's or editor's decision before drafting begins.

## `toh#_collation.md` and `.docx` — only when a collation was undertaken

Named for the text (`toh345_collation.md`), following the structure in
`collation.md`, and saved locally alongside `toh#_stage0.md`.

Also generate a Word mirror, **`toh#_collation.docx`**, via the `docx` skill —
Claude's general document skill, not one this plugin ships. The report is a
document editors and translators will want to review directly, so it follows the
same primary-`.docx` / documentation-`.md` convention as Stage 1 output.
