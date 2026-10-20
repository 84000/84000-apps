---
name: tibetan-english-passage-alignment
description: Report which span of Tibetan source text a passage of English translation renders, and which folio(s) it falls on. Most published works already have alignments recorded passage by passage — fetch those first with get-passage-alignments; derive a boundary by hand only where none is recorded. Use whenever a translator or editor needs English and Tibetan set against each other — "find the Tibetan for this paragraph of my draft", "where in Toh 312 does this sentence come from", "align this English passage to the source folios", "show me the aligned Tibetan and English for Toh 312", "pull the source spans for this work". Covers one given passage and a whole work alike. Do not use it to fetch Tibetan when there is no English to set it against — that is tibetan-source-text.
---

# Tibetan–English passage alignment

Set a passage of English against the span of Tibetan source text it renders, and
report which folio(s) that span falls on. A **recorded** alignment, stored
editorially, always comes first; a **derived** one, where you judge the
boundary yourself, is the fallback.

## The standard is in the policies

How a boundary is judged and rated — recorded before derived, clause
boundaries, the confidence scale, what never to change — is set by the studio
policy **`tibetan-english-passage-alignment/workflow`**, not by this skill, so
the research editor can revise it without a plugin release. Read it with
`read-policies` before deriving an alignment, and follow it. It is edited in
place, so the current text binds, not a remembered one.

- If `read-policies` is unavailable or the policy cannot be read, report
  recorded alignments as usual, but do not derive one. Say why.
- Where the policy and this skill seem to disagree, follow the policy and tell
  the person about the conflict.

> This skill is version-pinned: it ships with the `84000-translator-tools`
> plugin and cannot change mid-session. The policy it cites is not pinned.

## Step 0 — Look for a recorded alignment

Resolve the number with `resolve-toh` first if there is any chance it is
superseded or covered by another entry, then call `get-passage-alignments`:

- **A whole work** — address it by `toh` or `uuid`. Paging runs in reading
  order; `size` counts passages rather than alignments, so read `hasMore` and
  pass `nextCursor` back rather than stopping at a short page. Add
  `includeEnglish` when you want both halves side by side; leave it off when you
  already have the English, which is most of the time.
- **Passages you already hold** — pass their UUIDs as `passageUuids`. The
  response names any of them that carry no alignment, under `unaligned`.
- **One English chunk the person pasted** — find its passage first, with
  `search-translation` on a distinctive phrase, then ask for that passage UUID.

A work catalogued at several points in the canon carries one alignment per
placement, so a passage can come back with several spans in different volumes.
Report the one for the edition under discussion, and say that the others exist
rather than silently picking one. Pass `toh` to pin a single placement.

Present what comes back as-is, in the reporting format below.

**Only if nothing is recorded** — an empty result for the whole work, or the
passage listed under `unaligned` — derive it, per the policy. An empty result
does not mean the work has no Tibetan: the folios are still there.

## Deriving: inputs and retrieval

- **The English passage** — a sentence, a few sentences, a verse, or a
  paragraph; whatever chunk the person hands you.
- **The Tibetan source, folio-tagged** — folio records carrying `uuid`, `folio`,
  `side` and `content`, as returned by `get-translation-folios` and used by the
  `tibetan-source-text` skill.
- **A Toh number or work UUID**, if the Tibetan was not supplied folio-tagged,
  so you can retrieve it yourself.

To retrieve, resolve the number with `resolve-toh` first if there is any chance
it is superseded or covered by another entry, then call
`get-translation-folios`:

- **A location hint exists** — a rough folio number, a milestone from a stage-1
  draft, a hint from the person, or a prior alignment for a neighbouring
  passage. Address it directly with `folioNumber` + `side`, or centre on a known
  `folioUuid`, and widen with `before`/`after` only if the passage is not in the
  window. `hasMoreBefore`/`hasMoreAfter` tell you whether widening is even
  possible.
- **No hint at all** — page with `page`/`size` from the beginning, or from
  wherever context suggests ("a passage near the end of chapter 3"). Don't fetch
  an entire long work at once when a narrower window is plausible; don't
  under-fetch either.

Keep `uuid`/`folio`/`side` attached to each folio's content as you work — the
output needs them. To confirm what Tibetan an English term corresponds to for
this work, use `search-glossary-terms` or `get-glossary-instances`.

Note the character offset into that folio's `content` where the span starts
and ends on its first and last folio. This is not part of the reported output,
but keep it — it is what makes the alignment reproducible, and it matches the
anchor format the rest of this pipeline uses.

## Report

Use this format for a recorded alignment too, minus the confidence line. Note
that a recorded one arrives shaped a little differently: it names the folio the
span _starts_ on, and where the span runs past a folio break it marks the
crossing inline in the Tibetan as `[F.158.a]` rather than splitting into one
entry per folio. Keep those markers where they are — they are the citation — and
report the folios they name alongside the starting one.

For the aligned span:

- One entry per folio touched, each with `folio_uuid`, `folio_number`, `side`,
  and the Tibetan chunk from that folio — only the portion within the aligned
  span, not the whole folio.
- The English passage exactly as given.
- If more than one folio was touched, the full Tibetan chunk combined across
  folios in reading order.
- Whether the alignment is **recorded** or **derived**.
- For a derived one, the confidence level, per the policy.

Single folio:

```
English: "Ānanda, go to the city of Vaiśālī…"

Folio: uuid 799bcb19-218e-430d-8202-4c5164663dd4 · F.157b
Tibetan: "ཀུན་དགའ་བོ་ཡངས་པའི་གྲོང་ཁྱེར་ག་ལ་བ་དེར་འདོང་ངོ་། །"
Confidence: high
```

Spanning a folio break:

```
English: "…and the eight great bodhisattvas paid homage to all the buddhas."

Folio: uuid 799bcb19-… · F.157b
Tibetan (from F.157b): "…ཚིགས་སུ་བཅད་པ་"
Folio: uuid a42720dc-… · F.158a
Tibetan (from F.158a): "འདི་དག་སྨྲོས་ཤིག …"
Combined Tibetan: "…ཚིགས་སུ་བཅད་པ་འདི་དག་སྨྲོས་ཤིག …"
Confidence: moderate — boundary falls mid-formula; the exact split point is a judgment call.
```

## What not to do

- Do not guess a folio, or fabricate a `folio_uuid`, when the passage cannot
  actually be located. Say so instead.
- Do not derive a boundary without checking `get-passage-alignments` first.
- Do not write the result into the database. This skill finds and reports an
  alignment; it does not persist one. If the person explicitly asks you to save
  it, confirm the target table and required columns with them first.
