# The collation report

Recording that a parallel witness *exists* (`analytics.md`) is different from
actually comparing it against the base text passage by passage. When the
translator has asked for the latter, produce a **detailed collation report** as
its own deliverable — not as inline content inside `toh#_stage0.md`.

## When a collation happens

Only when the translator has asked for one.
`text-critical-guidelines/III.i-consult-other-versions.md` recommends consulting
at least one witness purely from the Thempangma line — the Stok Palace Kangyur
is the usual candidate, particularly for sūtras — in addition to the Degé and
its Pedurma apparatus. Treat that as a recommendation to raise with the
translator, **not as a default to apply to every text**: that same section is
explicit that the question is assessed on a text-by-text basis.

The same structure applies to any witness comparison the translator asks for: a
Sanskrit edition, an independent Kangyur witness, or a Chinese parallel.

## What a collation is not

This is Stage 0 apparatus. It compares witnesses and records findings; it does
not translate or emend anything. **Any departure from the base text that the
report recommends is a flag for Stage 1 to act on explicitly** — per the
first-draft rule against silent emendation — never a silent substitution.

## Structure

1. **Header.** The work's title, its Toh number, and the witnesses being
   compared, each given a short code (D = Degé, S = Stok Palace). Use the codes
   throughout the report rather than spelling out each witness every time.

2. **Prefatory note.** State which witnesses were compared and what lineage or
   recension each represents; why the comparison was undertaken, citing the
   governing provision (for a Thempangma check,
   `text-critical-guidelines/III.i-consult-other-versions.md`);
   the scope of the comparison, whether full text or a stated partial range; the
   total count of variant locations identified; and — explicitly — what kinds of
   difference were excluded from the table and why. Shad placement, spacing, and
   tsheg-only differences are typically frequent, consistent, and without
   semantic significance. Say so plainly rather than dropping them silently.

3. **Categories.** Define the classification scheme before the table, so the
   table's category column is self-explanatory. Use these five unless the text
   gives good reason to adapt them:

   | | |
   |---|---|
   | **Substantive** | Affects or potentially affects meaning; requires a translation decision and/or a note |
   | **Scribal** | A clear, identifiable scribal error in one witness |
   | **Orthographic** | Different but equivalent spellings of the same word |
   | **Punctuation/Spacing** | Shad, spacing, or tsheg only; no semantic significance — usually the category excluded per item 2 |
   | **Colophon** | Variants confined to the colophon |

4. **Summary of substantive variants.** A short, quickly scannable list of only
   the variants classified Substantive, each with a one-line description of the
   difference and the preferred reading. Pulled from the full table for rapid
   reference — not a replacement for it.

5. **Full collation table.** One row per variant location, with columns:

   - number;
   - location — a description specific enough to find the passage, such as a
     section or chapter label, or a verse or line reference;
   - each witness's reading, one column per witness, labeled by its code;
   - category, per item 3;
   - notes and preferred reading — the variant explained, a hypothesis about its
     cause where relevant — `text-critical-guidelines/V.ii-causes-of-variation.md`
     lists the patterns to hypothesize from, including the orthographic shifts
     that occur moving cursive script into print — and which reading is
     preferred and why.

   Distinguish Substantive rows visually — bold or highlighted — so they are
   easy to spot when scanning the full table.

6. **Recommendation for translation.** State which witness remains the primary
   source text going forward. Normally this is the Degé, per the first-draft
   source-authority rule: a collation informs the translation, it does not
   relocate the sole authority.

   Then list, explicitly, any variant locations where a *non-primary* witness's
   reading is recommended for the translation instead, and supply the exact note
   language Stage 1 should use for each — so the translator is not left to
   reconstruct the reasoning later. **If no such cases exist, say so plainly**
   rather than leaving the section implicitly empty.

## The report recommends; it does not decide

Do not treat the report's preferred-reading calls as settled decisions the
translator must follow. They are Stage 0's best-supported recommendation,
consistent with the principle of recording each variant reading, the preferred
reading, and the reason for the preference, set out in
`text-critical-guidelines/III.iii-document-your-work-tibetan-versions.md` and,
for Sanskrit comparison,
`text-critical-guidelines/II.vii-document-your-work-sanskrit.md` — but the
translator or editor retains the final call, and adopting any non-primary
witness's reading still needs its own note in the Stage 1 draft.

## Not this

- **Do not let preferred-reading calls function as a silent emendation** of the
  base text. Adopting any recommendation in the actual translation still
  requires its own explicit note at Stage 1.
- **Do not omit punctuation- or spacing-only variants without saying so** in the
  prefatory note. Silent omission looks like an incomplete comparison rather
  than a scoped one.
