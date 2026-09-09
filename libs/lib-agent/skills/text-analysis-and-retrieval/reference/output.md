# Output

Store the results in a single markdown document named `toh#_stage0.md` —
`toh345_stage0.md`, for instance — written to a local file rather than delivered
only inline in the conversation, then saved to storage per *Saving to storage*
below. The local file is how the translator works; the saved copy is where the
stage's record lives, and it is what Stage 1 reads before drafting begins.

## `toh#_stage0.md` — the Stage 0 record

Use this structure, in this order:

1. **Catalog record** — Toh number, title(s) as given in the catalog, canonical
   section, Degé volume and folio range, any duplicate locations, bam po markers
   if noted.
2. **Structural overview** — chapter and section count, prose versus verse
   composition, approximate length, any structural anomalies worth flagging.
3. **Genre and register** — as established in `shared-policies/analytics`, marked as
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
`shared-policies/collation`, and saved alongside `toh#_stage0.md` — locally and
in storage both.

Also generate a Word mirror, **`toh#_collation.docx`**, via the `docx` skill —
Claude's general document skill, not one this plugin ships. The report is a
document editors and translators will want to review directly, so it follows the
same primary-`.docx` / documentation-`.md` convention as Stage 1 output.

Give it the same typographic treatment as the Stage 1 draft, so the two stages'
documents read as one family. **Set the default font to Times New Roman** — the
Normal style, body text, headings, and the collation table alike — and **set the
point sizes explicitly**, rather than leaving the `docx` skill's template at its
uniform 11pt:

| Run | Size |
|---|---|
| Body text, and the collation table | 12pt |
| Footnotes, where the report uses any | 10pt |
| Tibetan readings in **Unicode (Uchen)** | 14pt |
| Tibetan readings in **Extended Wylie** | 12pt |

*Exception, as at Stage 1:* Times New Roman cannot render Uchen glyphs, so leave
Tibetan Unicode runs in a Tibetan-capable font rather than forcing Times New
Roman onto them. Extended Wylie, being Latin script with diacritics, follows the
Times New Roman default like the rest of the document.

The witness-reading columns are the substance of this report and get read
character by character — a single letter is often the whole variant — so the
Uchen size matters more here than anywhere in the Stage 1 draft.

## Saving to storage

Save the stage's deliverables to storage once the local files are written and
complete. Without this, the record is only on one machine and Stage 1 has
nothing to read.

Call `write-session-documents` with:

| | |
|---|---|
| `toh` | the work's Toh number, e.g. `toh345` |
| `stage` | `stage0` |
| `files` | `toh#_stage0.md` as `primary`; the collation pair, `toh#_collation.md` and `toh#_collation.docx`, as `supporting` when a collation was undertaken |
| `model` | your model name, and its version only if you know it — see below |

Do not pass `manifest.json`. The manifest recording the work, who saved the set,
when, and with what model is written for you, and is refused as an upload
precisely so its identity and timestamp are not yours to assert.

The tool authorizes the writes and returns one `uploadUrl` per file, each valid
for two hours. **It does not carry the bytes** — PUT each file yourself, with
the `contentType` the response gives for that file:

```sh
curl -X PUT -H "Content-Type: <contentType>" --data-binary @<file> "<uploadUrl>"
```

That PUT is an outbound HTTP request the session makes itself, and it is the one
capability this step adds — the studio's other tools need nothing like it. Any
client that can read a local file's bytes and PUT them to a supplied URL is
sufficient: a shell, a code interpreter, or a plain HTTP-fetch tool all qualify,
and the `curl` above is only the most convenient form. The filesystem half is
already assumed, since the stage writes its deliverables to local files first.

If the client cannot make an outbound request, **say the documents could not be
saved to storage** rather than reporting a save that did not happen. The local
files are still the deliverables and the stage's findings still stand; what is
missing is the record Stage 1 reads, so a Stage 1 session will find nothing for
this work and needs to be told why.

**The save is not complete until every PUT has succeeded.** The manifest is
written when the URLs are issued, so a file whose upload failed or was skipped
is described by the manifest but absent from storage. Check each response and
report any that failed.

A stage's files may be saved across more than one call — the collation pair
later than the record, say — and the manifest carries forward what an earlier
call recorded, so a second call does not erase the first. Re-running the stage
archives the previous revision of each path rather than destroying it, which
makes a re-run recoverable; it is not a reason to skip the confirmation that
*Not this* in `SKILL.md` asks for.

On `model`: record the name you know, and omit the version if you do not know it
reliably. Do not guess it, and do not withhold the save over it.
