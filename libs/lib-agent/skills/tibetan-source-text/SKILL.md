---
name: tibetan-source-text
description: Fetch the Tibetan source text (Degé Kangyur/Tengyur, Uchen Unicode) of a canonical work from the 84000 studio, given a Toh(oku) catalog number. Use whenever the person asks to see, pull up, compare against, or check the Tibetan of a text by its Toh number — "get the Tibetan for toh312", "pull up the source text of Toh 1", "show me folio 5a–7b of Toh 9", "what does the Degé say at F.157b of toh312". Also trigger when a translator or editor is comparing an English draft against the Tibetan source, checking a folio citation, or needs the canonical wording for a passage — even without the word "toh", if they cite a Degé folio for a known work. Tibetan source only: not Sanskrit, not the published English translation.
---

# Tibetan source text

Retrieve a work's Tibetan source folios from the studio and present them
citation-ready. This skill only fetches and formats — it does not align,
analyze, or judge the text.

## Retrieve

1. **`resolve-toh`** with the number exactly as the person wrote it. It accepts
   any written form, and it is what tells a superseded or covered number apart
   from one that does not exist — both of which otherwise read as a missing
   work. Pass the `toh` it returns onward, never the one you were given.
   - `alias: true` means the number was reached through a catalogue note. Say so
     plainly ("Toh 418 is catalogued here as Toh 417") rather than swapping the
     number silently.
   - More than one entry in `placements` means the work sits at several distinct
     points in the canon, each with its own folios. Mention it; fetch the others
     only if asked.
   - More than one resolution means the number is genuinely ambiguous. Report
     that instead of choosing.
2. **`get-translation-folios`** with the resolved `toh`. Address a cited folio
   with `folioNumber` + `side` and widen a range with `after`, rather than
   guessing a page offset. For a whole work, page until a page comes back
   shorter than `size`.

## Present

Folio by folio, never as one continuous block — this matches 84000's citation
style and lets the translator cross-check a specific passage.

```
**Toh 312** — *[title, if known]* — Vol. 72

**F.157b**
༄༅༅། །རྒྱ་གར་སྐད་དུ། …

**F.158a**
…
```

Note the volume whenever it changes; each folio reports its own.

Return the Tibetan exactly as retrieved (Uchen Unicode, line breaks preserved).
Do not translate, transliterate, normalize orthography, or "correct" it against
a Sanskrit or Chinese witness — that is an editorial judgment, never something
this skill does unprompted.

## When nothing comes back

Two different situations, worth distinguishing for the person:

- **`resolve-toh` finds nothing** — no work is catalogued under or cited as that
  number. Show the number you searched and ask them to check it. Do not try a
  nearby one.
- **It resolves but has no folios** — the work is in the catalogue, but its
  Tibetan has not been loaded. Say that explicitly; it is not the same as the
  number not existing.
