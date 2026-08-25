---
name: glossary-by-canon-section
description: Look up how a term is glossed across every work in a canonical section of the Kangyur or Tengyur — "the glossary entry for karman in the Action Tantra section", "how is bodhicitta glossed across the Perfection of Wisdom sūtras", "every gloss of nirvāṇa in the Vinaya section". This is the escalation when a term is not glossed in the work being translated: there is no library-wide glossary search, and canon-section neighbours are the closest comparable authority. Do not use it for a single-work lookup — that is get-glossary-instances or search-glossary-terms. Do not treat a Toh range the person types as a section; always resolve the section by name.
---

# Glossary by canonical section

A per-work glossary lookup covers one work, and there is no library-wide search.
When a term is not glossed in the work at hand, escalate to that work's
canonical section rather than concluding the house has no rendering for it.

## Resolve the section

`search-canon-sections` with the section name. Matching ignores diacritics and
covers alternate-language names.

**Several matches is the normal case, not an error** — "Action Tantra" names
both a Kangyur section (*Action Tantras*, Toh 502–808) and a Tengyur one
(*Action Tantra Treatises*, Toh 2670–3139). Check `parentLabel` and `tohRange`
before choosing:

- If the person's context settles it — they are plainly discussing the Kangyur,
  or commentarial treatises — proceed and say which you picked.
- Otherwise show both with their parent and Toh range and ask, or run both and
  label the results by section.

Sections nest, and works hang off the leaves, so a section near the root of the
canon has a `directWorkCount` of 0 and a large `descendantWorkCount`. Leave
`includeDescendants` at its default — "the X section" colloquially means the
whole division.

## Look the term up

`search-canon-section-glossary` with that `uuid` and the term, in any glossed
language (English, Sanskrit IAST, Wylie, Tibetan).

It reads the **published** snapshot by default, which is the right default when
the answer will bind a translator: what binds is the house rendering as
published, not terminology still under editorial review. Pass
`source: "draft"` only deliberately, and say so when you do.

Results come back grouped one entry per work, in Tohoku order. One spelling can
still belong to more than one glossary concept — *karman* as the doctrinal
notion of karma versus *karman* as a specific ritual act — so read `headword`
and `definition` across the groups before answering. Where two genuinely
different concepts come back, either narrow to the one the person means and say
you did, or report them separately.

## Present

One entry per work by default. Break out individual instances only if the person
asks for occurrence-level detail.

```
**Action Tantras** (Toh 502–808) — *karman* (Skt.) / headword *las*

- **Toh 519 / 979** — *The Ritual Dhāraṇī "The Essence of Dependent Arising"*
- **Toh 543** — *The Root Manual of the Rites of Mañjuśrī*

> Meaning "action" in its most basic sense, karma is an important concept in
> Buddhist philosophy as the cumulative force of previous physical, verbal, and
> mental acts…
```

Sanskrit comes back already in IAST — pass it through rather than converting.

## When nothing comes back

Two distinct failures, and conflating them misleads:

- **The section did not resolve.** Show what you searched for and ask them to
  check the name, or browse with a broader query.
- **The section resolved but the term is not glossed in it.** Say so plainly.
  Do not silently widen the search to another section or the whole canon; offer
  to, and let them decide.
