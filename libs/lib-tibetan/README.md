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
