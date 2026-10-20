---
name: kangyur-tengyur-recensions
description: Find every recension of a canonical work across the Kangyur, Tengyur and Nyingma Gyubum eText collections from a Toh number — collection, volume, folio range and how far the boundary can be trusted — and read or search the eTexts themselves. Use when a translator or editor asks which recensions or witnesses of a work exist, where a text sits in the Stok, Peking, Narthang, Phugdrak or Drakmar Kangyur or a Tengyur, for the Stok or Peking text of a passage, to search Kangyur or Tengyur titles, or to search a collection's text for a phrase or for works citing a text. Not for collating witnesses, and not for the Degé source with 84000's folio references, which is the tibetan-source-text skill.
---

# Kangyur and Tengyur recensions

Every witness of a work in the 84000 eText collections, from its Toh number,
and the eTexts themselves. A work can sit at two places in the Degé, or in both
canons (Toh 815 in the Kangyur is Toh 4382 in the Tengyur): report every one.

The data comes as downloadable archives, so the work runs in a shell. Without a
shell, or without `download-snapshot`, say so and stop: never guess a folio
range.

## Get the catalog

1. Resolve the work with `resolve-toh`. A cited number may be superseded,
   covered by another entry or lettered; use the number it resolves to.
2. Call `download-snapshot` with `dataset: etexts-catalog`. Its first line names
   the build. If `etexts-<build id>/etexts/README.md` already exists in the
   working directory, use that copy and skip the download.
3. Otherwise make `etexts-<build id>/`, run the fetch command the tool returns
   inside it, then delete the `.tar.gz`. The URL is a credential: do not log or
   save it.
4. **Read `etexts/README.md` before anything else.** It is generated with the
   data and is the authority on the files, their columns, the collections in
   this build, how to read boundary status, and each collection's known
   weaknesses. Where this skill and the README differ, follow the README.

## Find the witnesses

Follow the path the README gives from a Toh number to its conceptual work and
from there to every witness. Then:

- Collect every Toh number on the conceptual work, and report the others as
  "also catalogued as", naming the canon of each.
- List every witness, including those with no folio range: give their volume
  and BDRC id so the scan can be checked.
- Give each witness's boundary status and what it means, as the README
  explains it. Flag anything below high confidence.
- Note duplicates within one collection (the Peking Kangyur has Toh 567 twice)
  and variant titles.

A Toh number with no conceptual work is "not in the eText catalog"; say so and
say what `resolve-toh` returned. Do not search by title to fill the gap without
saying that is what you did.

## Search titles

Search the Tibetan, Sanskrit and English titles, and the variant titles, in the
catalog, case-insensitively. Titles are Wylie. Report each hit with its Toh
numbers and collection, as for witnesses.

## Read or search the text

Only when asked, or when a Stage 0 step needs it: a collection's text is a
large download (the tool reports its size; tell the user before fetching more
than one).

1. Call `download-snapshot` with `dataset: etexts-text` and the collection
   (the README lists them). Fetch it into the same `etexts-<build id>/`
   directory as the catalog, so both unpack under one `etexts/`. Reuse an
   existing copy for the same build id.
2. A witness runs from its start folio to its end folio, which may cross
   volumes. Its first and last sides usually also hold the neighbouring texts;
   the README says where a text opens and closes.
3. To search, grep the collection's text files. Each line is one folio side
   and begins with its folio reference, so a hit gives its location (a side
   marked as unnumbered is located by the numbered line before it). Some
   collections are Unicode Tibetan and others Wylie (see the README); search
   each in its own script, and convert Wylie to Unicode per
   `shared-policies/transliteration`, not by hand. Without that policy or a
   converter, search the Unicode collections with strings copied from the
   work's Degé source (the `tibetan-source-text` skill), or say they were not
   searched. OCR text is noisy: search for short, distinctive
   strings and try variant spellings before reporting nothing found.
4. Quote only what the user needs. Do not reproduce long stretches unless
   asked.

## Output

Lead with the work: its Tibetan title (Wylie, no capitals), the conceptual
work's BDRC and rKTs ids, and every catalogue number. Then one table per canon,
Kangyur first, Degé first within each:

| Collection       | Siglum | Vol. | Folios     | Status    |
| ---------------- | ------ | ---- | ---------- | --------- |
| Degé Tengyur     | D3871  | 105  | F.1.a–40.a | reference |
| Narthang Tengyur | N4061  | 114  | F.1.b–38.b | anchored  |
| Peking Tengyur   | Q5272  | 114  | F.1.b–45.a | anchored  |

Write folios in 84000 style (`F.186.a–191.b`). When a witness crosses volumes,
give both (`41–42` under Vol., and the folio range across them). After the
tables, list low-confidence rows and why, and any witnesses with no eText. End
with the build id, so the result can be traced. Treat Sanskrit titles from the
catalog as mechanical conversions, not edited IAST.

## Housekeeping

The unpacked text of a large collection runs to hundreds of megabytes. When
you are done, tell the user which `etexts-<build id>/` directories you left and
their sizes. Delete one only when the user agrees.
