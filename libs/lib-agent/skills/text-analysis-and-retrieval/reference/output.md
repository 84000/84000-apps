# Output

Stage 0 produces one report, `toh#_stage0.md` — `toh345_stage0.md`, for
instance — written to a local file and then saved to storage per _Saving to
storage_ below. The saved copy is the stage's record and is what Stage 1 reads
before drafting begins and Stage 2 reads before reviewing.

A Word mirror, `toh#_stage0.docx`, is generated for the translator, who reads
and annotates the report in Word. It carries the same content as the markdown,
set in Times New Roman at 12 pt, headings and body alike. Because every
Tibetan string in the report is EWTS, no Tibetan font is needed. _[To confirm
with the team: the previous specification named the markdown as the only
deliverable.]_

For a text with two Toh numbers, join them with a hyphen: `toh773-969`.

## The report

Six sections, in this order, and nothing else. No preface, no method
statement, no appendix. Each section ends with a one-line **Scope** note
saying what was searched or read and what was not; a section whose scope is
simply "the retrieved text" says so.

All Tibetan is EWTS in italics, per `shared-policies/transliteration`. Labels
are bold run-in labels, not tables, except where a section below says
otherwise.

### 1. Catalog Record

Fields in this order, each a bold run-in label followed by its value:

- **Work UUID:** as `resolve-toh` gives it.
- **Toh number**, as a bold line: `**Toh 464**`. A work with several
  placements lists every number.
- **Tibetan title:** the full Tibetan title, EWTS. Where the catalog's main
  title is a short form and a longer title exists, give the longer.
- **Sanskrit title:** the catalog's IAST title, followed in parentheses by the
  Sanskrit title as written in the text, in EWTS, introduced by its folio only:
  `(F.69.a: b+ha ga bAn badzra pA Ni …)`. If the text gives no Sanskrit title,
  the parenthesis reads `(none given in the text)`. If the catalog gives none,
  write `None recorded in the 84000 catalog`, then the in-text form. A routine
  difference between the catalog's reconstruction and the text's form gets no
  comment; a material divergence goes to Open Questions.
- **English title:** the 84000 record's English title.
- **Chinese title:** as recorded, else `None recorded in the 84000 catalog.`
- **Bibliographic reference:** in the form of the _Cumulative Bibliography and
  Citation Templates_: `Degé Kangyur vol. 83 (rgyud ’bum, ja), folios
69.a–90.b.` No comma after "Degé Kangyur"; the volume information in
  parentheses is set in roman, not italics; the section label for the Tantra
  Collection is _rgyud ’bum_. A work with more than one placement gets one
  reference per placement, each on its own line. Where the 84000 data does not
  supply the section label or volume letter and it is taken from a neighboring
  work, mark it † and add a one-line note saying so.
- **Base text:** only when a base text other than the Degé was named for this
  run: which it is, and who named it. Omitted otherwise.
- **Canonical section:** the section title only, exactly as the catalog gives
  it.
- **Translators’ colophon (F.n):** the full translators’ statement, quoted in
  EWTS, with the folio on which it falls. Where the text has no translators'
  colophon, write `none given`. The colophon is everything after the work's
  closing title statement (_… zhes bya ba rdzogs so_); where there is no such
  statement, it begins at the first sentence naming a translator, editor or
  reviser.

Nothing else: no catalog-versus-source line, no _bam po_ note, no catalog
translator field, no neighboring works. Those either go to Open Questions when
they raise a problem or to §5.

### 2. Structural Map

A navigation map of the text in text order, built by the two-pass sweep in
`shared-policies/analytics`. In this order:

- **Setting (F.n):** two or three lines at the _nidāna_: the place, the
  teacher and the audience categories as the text names them, long lists
  collapsed ("bodhisattvas led by _byams pa_"). A later change of setting is
  its own map entry with a folio.
- **Interlocutors:** one line each, recorded only for figures who take a role
  as questioner, respondent or principal speaker, at first appearance and
  again only when the role changes hands. If more than eight to ten figures
  qualify, name the principal ones and count the rest.
- **Map:** one line per entry, folio or folio range first, then the content.
  Division entries give the title as the text gives it, in EWTS, with no
  prefix such as "_le’u_ 1:"; nested levels are indented. Fixed elements —
  title lines, homage, _nidāna_, concluding statement, final title,
  translators' colophon — are named in English. Inferred entries carry their
  cue in square brackets: `[inferred: new questioner]`.

A division's range runs from the folio of its first words to the folio where
its closing formula ends. Irregularities — a missing closing formula, a skipped
or repeated ordinal, a title that clearly diverges between a division's opening
and its closing — are recorded in the entry where they occur, never reconciled.

### 3. Major Themes

_Themes the text treats at length, in text order, as read by Stage 0. Labels
are descriptive, not proposed renderings._ That line opens the section every
time; it marks the list as Stage 0's reading of the text.

Then a list, one or two lines per theme: a descriptive English label in bold,
the text's own key term or terms in EWTS, and the folio range or ranges. No
fixed number of themes; the qualifying test in `shared-policies/analytics`
limits the list. No interpretation.

### 4. Precedent Translations

Three labeled groups, any of which may be empty:

- **Verified:** one entry per publication whose own record was reached, giving
  title, translator, year and publication details.
- **Leads:** one entry per publication not reached but pointed to by a source
  that was, giving the citation as the source gives it and the source itself
  (URL or bibliographic reference).
- **None located**, where both groups are empty, followed by the routes run.

Then the **Scope** line: the routes run (84000 bibliographies; web search)
and the query list. A route that could not be run is named as not run, with
the reason. The specialist catalogs (rKTs, BDRC, library catalogs) are not
searched; the line does not list them.

### 5. Kangyur and Tengyur Resources

Subsections in this fixed order, each governed by
`shared-policies/canonical-resources`:

1. **Recensions of the base text** — always first, whether the base text is a
   Kangyur or a Tengyur work. One line per witness: collection, siglum,
   volume, folio range in house form, boundary confidence as the eText catalog
   gives it. The Degé line first. Duplicates within one collection, variant
   titles and low-confidence boundaries are noted on the line.
2. **Kangyur Resources**
   - _Textual relation_
   - _Practice relation_ (including praises)
3. **Tengyur Resources**
   - _Exegetical sources_ — this heading is read by name by Stage 1 and by
     `shared-policies/commentary-consultation`; keep it.
   - _Practice relation_ (including praises)
   - _Works citing the text_

Each subsection lists the closely tied works in full, as entries in the fixed
field order the policy gives, then a plain line of **Further Toh numbers to
check**, then its **Scope** line. "None located" is the finding when nothing
qualifies; it is recorded, with the scope, never left blank.

Nothing in this section asks the translator to choose. The exegetical-sources
entries carry what a Stage 1 prompt needs to put the choice to the translator:
retrievability, form and the anchoring result.

### 6. Open Questions

A numbered list. Each item is one line, in three parts: the question; the
section it arises from; the decision or action it needs. Only items that need
a decision from the translator or editor and that Stage 0 could not settle from
its sources. Routed here by the sections above:

- a catalog-versus-source discrepancy in volume or folios (§1);
- a material divergence between the catalog's Sanskrit title and the one in
  the text (§1);
- a catalog gap the front matter will need filled, such as a missing volume
  letter or an empty translator record (§1).

Not here: division irregularities and title discrepancies (they stay on the
map, §2), secondary-source claims (they are labeled in their own entries, §4
and §5), observations about the text's history or transmission, and anything
interpretive. A search that could not be run is stated in its section's scope
line, not here.

## Saving to storage

Save the deliverables once the local files are written and complete. Without
this the record is only on one machine, and Stage 1 — which reads
`toh#_stage0.md` from the bucket before drafting — has nothing to read.

`reference/session-documents/saving.md` is the mechanism: the call, the upload
URLs and the PUT that carries the bytes, what happens on a re-run, and what to
do when the client cannot make an outbound request. Read it before the first
save of a session.

What this stage supplies:

|         |                                                                   |
| ------- | ----------------------------------------------------------------- |
| `stage` | `stage0`                                                          |
| `files` | `toh#_stage0.md` as `primary`; `toh#_stage0.docx` as `supporting` |

Before re-running the stage for a work, check what is already saved with
`read-session-documents`; `reference/session-documents/reading.md` covers that
call. A re-run archives rather than destroys, but _Not this_ in `SKILL.md`
still asks you to confirm one is intended.
