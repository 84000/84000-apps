# @eightyfourthousand/lib-tibetan

Tibetan text helpers that run anywhere: no dependencies, no DOM, no Node APIs.

## EWTS

`toEwts(text, { finalShad })` converts Tibetan Unicode to Extended Wylie in the
84000 house profile (the studio policy `shared-policies/transliteration`): the
a-chung as `’`, explicit `+` stacking for Sanskrit, native stacks written
normally, and an ordinary space after a shad. `finalShad: 'drop'` is for a
title, term or name quoted on its own; the default, `'keep'`, is for a quoted
passage. Text outside the Tibetan block passes through unchanged.

`toEwtsWithWarnings` returns the same string plus warnings for anything a
reader should check against the Unicode.

Every caller — the `transliterate` MCP tool and the download layers — uses this
one function, so the same input gives the same EWTS everywhere.

## Syllables for search

`tibetanSyllables(text)` splits Tibetan Unicode or EWTS into syllables, each
with its EWTS, its position in the text, a search `key` and a `sanskrit` flag.
Tsheg, shad, spaces, digits and line breaks only separate syllables, so a
passage matches whatever its punctuation or line breaks.

The key is the same in both scripts: Unicode is read through `toEwts`, then
stacks are flattened to their letters, the vowel a is dropped and retroflexes
fold to dentals, with anusvara and visarga kept as `M` and `H`. So the Degé
Unicode `བཻ་ཌཱུཪྻ` and the rKTs EWTS `bai DUR+Ya` give the same keys. A syllable
reads as Sanskrit when it has a long vowel, a retroflex, a fixed-form R, Y or
W, an anusvara, a visarga or a reversed i. An illegible syllable (EWTS `x`) has
an empty key.

`ewtsSkeleton` reduces one EWTS syllable, and `detectScript` says which script
a text is in.
