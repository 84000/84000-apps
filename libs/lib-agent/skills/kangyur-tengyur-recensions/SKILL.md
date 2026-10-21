---
name: kangyur-tengyur-recensions
description: Find every recension of a canonical work across the Kangyur, Tengyur and Nyingma Gyubum eText collections from a Toh number — collection, volume, folio range and how far the boundary can be trusted — and read or search the eTexts themselves. Use when a translator or editor asks which recensions or witnesses of a work exist, where a text sits in the Stok, Peking, Narthang, Phugdrak or Drakmar Kangyur or a Tengyur, for the Stok or Peking text of a passage, to search Kangyur or Tengyur titles, or to search a collection's text for a phrase or for works citing a text, or to find the passages of a work quoted in another collection (which Tengyur works quote Toh 464). Not for collating witnesses, and not for the Degé source with 84000's folio references, which is the tibetan-source-text skill.
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
   the build. If `84000/cache/etexts/<build id>/etexts/README.md` already
   exists, use that copy and skip the download.
   `reference/local-files/layout.md` says where 84000 files go.
3. Otherwise make `84000/cache/etexts/<build id>/`, run the fetch command the
   tool returns inside it, then delete the `.tar.gz`. The URL is a credential:
   do not log or save it.
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
   (the README lists them). Fetch it into the same
   `84000/cache/etexts/<build id>/` folder as the catalog, so both unpack under
   one `etexts/`. Reuse an existing copy for the same build id. Write anything
   you derive from the text under `84000/scratch/`, never into the cache.
2. A witness runs from its start folio to its end folio, which may cross
   volumes. Its first and last sides usually also hold the neighbouring texts;
   the README says where a text opens and closes.
3. To search, use `eft search` (below), not grep: it reads Unicode and
   Wylie collections alike, and a match is not stopped by a tsheg, a shad, or
   a line or folio break. Each line of a text file is one folio side and begins
   with its folio reference, so every hit gives its location (a side marked as
   unnumbered is located by the numbered line before it). OCR text is noisy:
   use `search phrase` rather than `search grep` for it, and try variant
   spellings before reporting nothing found.
4. Quote only what the user needs. Do not reproduce long stretches unless
   asked.

## The search tool

`scripts/eft.mjs` in this skill is 84000's command line, `eft`. Run it with
node: `node "<this skill>/scripts/eft.mjs" <command> …`, where
`<this skill>` is the directory this file is in. It has no dependencies, and
the same inputs always give the same output. (It will also come as a
standalone program; a downloaded copy belongs in
`84000/cache/bin/eft/<version>/`, as
`reference/local-files/layout.md` says, but until this skill names a version
to fetch, use the script.)

Every `search` command takes a corpus: a collection directory of a download
(`84000/cache/etexts/<build id>/etexts/text/tengyur/D`), any directory of
`.txt` files, or one `.txt` file of `[F.12.a] …` lines. In a collection
directory each hit names the witness at its folio, from the catalog. A pattern
or phrase can be Unicode or Wylie, whatever the corpus is in.

- `search grep <corpus> <pattern>`: every exact occurrence, as whole
  syllables.
  `--regex` takes a regular expression over the text as Wylie syllables
  separated by single spaces; `--fold` matches as `phrase` does, ignoring
  spelling the two scripts write differently. `--context 8` sets the syllables
  of context shown, `--max` caps the hits.
- `search phrase <corpus> <phrase>…`: fuzzy search for one or more phrases (or
  `--phrases-file`, one per line). A hit shares at least `--min-share 0.6` of
  a phrase's syllables, so it survives OCR errors and spelling variants. Each
  hit gives the phrase's number, the syllables matched and the phrase's length.
- `search quotes <corpus> <root-file> --out <dir>`: every passage of a root
  text found in the corpus (below).
- `extract <collection-dir> <toh>`: one witness's folio range, trimmed at the
  neighbouring texts.

Output is a table with a header row; `--json` gives JSON lines. Add `--help`
to a command for every option. Save output you keep, and any file you write for a search,
under `84000/scratch/<toh>/<command>/` (`84000/scratch/toh464/grep/`), or
`84000/scratch/<command>/` when the search is not about one work; never in the
cache.

## Find quoted passages

To find where a work's passages are quoted in a collection — the Degé Tengyur
for works citing a text, or another Kangyur to check a recension — use
`search quotes`. A search of the whole Degé Tengyur takes about a minute. Search the
whole root at once, never by grepping hundreds of phrases one at a time.

1. Fetch the catalog and the text of both the root text's collection and the
   collection to search, as above, into one `84000/cache/etexts/<build id>/`.
   That is two text archives: tell the user their sizes first. Below, `E` is
   that folder's `etexts/`, and `S` is `84000/scratch/<toh>/quotation-search/`
   for the root text's Toh number.
2. Write the root text to a file. From its Degé eText witness:

   ```sh
   node "<this skill>/scripts/eft.mjs" extract "$E/text/kangyur/D" toh464 --out "$S/toh464.txt"
   ```

   Any plain-text file of the root text works instead, Unicode or Wylie,
   ideally with each line opening `[F.12.a]` so hits carry root folios.

3. Search:

   ```sh
   node "<this skill>/scripts/eft.mjs" search quotes "$E/text/tengyur/D" "$S/toh464.txt" --out "$S/tengyur-D"
   ```

   It writes `hits.tsv` (to read), `hits.jsonl` (the same, plus the character
   offsets of each hit in its first and last side) and `summary.json` (the
   build, the parameters and the counts), best hits first.

Each hit is a passage of at least 10 syllables shared with the root text:
`vol`, `from`–`to` (its folios in the searched collection), `rootFrom`–`rootTo`
(where it is in the root), `matched` (syllables in common), `witness` and
`title` (the work at that folio, from the catalog; a side two works share
lists both), the passage itself, and `score`. The score adds up the passage's
six-syllable phrases, each weighted by how rarely it occurs in the whole
collection, so a long passage of rare phrases ranks above a common formula.

How the matching treats the text:

- Unicode and Wylie are compared syllable by syllable on a shared skeleton, so
  a Degé root can be searched against the Stok or Peking Kangyur, and a
  quotation is found whatever its punctuation and across a folio break.
- Mantras and Sanskrit are left out: a phrase with more than one syllable
  marked as Sanskrit (a long vowel, a retroflex, a fixed-form letter,
  anusvara, visarga or reversed _i_) never seeds a match, and a passage mostly
  of such syllables is dropped. A phrase found more than 30 times in the
  collection is a stock formula and does not count.
- OCR noise lowers recall. In a test on Toh 464, the hits covered 92% of the
  Tibetan of the Stok witness and 81% of the noisier Peking one.

**A hit is a shared passage, not yet a quotation.** Before reporting one, read
it in context: open its side in `$E/text/<collection>/<vol>.txt` and the root
at `rootFrom`. Then decide, and say which applies:

- it quotes the text — a citation formula (_… las_, _… zhes gsungs pa_) or
  the text's title nearby;
- it shares a passage the text also draws on — a ritual verse found in
  several manuals is shared, not quoted from this text;
- it is the text's own witness (when searching its own canon), or a
  coincidence of stock phrasing.

Report the hits you checked with their folios and the evidence for each, and
say how many hits you did not check. Searching another Kangyur for the same
text is a recall check: its hits should run end to end through that witness's
folio range.

The defaults (`--n 6 --min 10 --max-freq 30 --gap 12`) suit a whole root text.
Lower `--n` to 5 or raise `--gap` for noisy OCR, which finds more and adds
more stray hits; say what you changed.

## Reporting witnesses

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

The unpacked text of a large collection runs to hundreds of megabytes. Keep it
for reuse, and follow _After a download_ in `reference/local-files/layout.md`:
when the cache is large, point the user to the `tidy-local-files` skill rather
than deleting anything yourself.
