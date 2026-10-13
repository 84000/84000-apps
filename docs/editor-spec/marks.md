# Inline marks (ED-MRK)

Text styles are stored as `span` annotations whose content names the style,
plus `mantra` for mantras.

### ED-MRK-01 Text styles (D + J)

- Fixture, already seeded: bold in `s.2` ("synthetic"), italic in `1.1` ("lotus pond"),
  underline ("underlined") and the _distinct_ style ("the testing lotus") in `i.6`, and small caps, subscript and
  superscript in `i.4` ("pāramitā", "66", "nd").
- Screen: each renders with its style (`font-weight`, `font-style`,
  `text-decoration`, `font-variant` / small caps, `vertical-align` sub / super).
- Do: in `1.12`, select "ordinary" and apply bold, then italic, underline,
  subscript, superscript and small caps in turn, saving after each and removing
  the style again before the next.
- Stored: after each save, `1.12` has exactly one new `span` row over
  "ordinary" whose content names that style. After the style is removed and
  saved, the row is gone.
- J: the bubble menu shows the active styles for the selection, and the
  keyboard shortcuts (bold, italic, underline) toggle the same marks.

### ED-MRK-02 Foreign language and mantra (D)

- Fixture: there are foreign spans in `ap1.1` (Sa-Ltn "karuṇā" and
  "prajñāpāramitā"), `c.2` (Bo-Ltn), `h.1` (bo, Tibetan script), `i.3`
  (zh, "試蓮經"), and `pl.1` (Pi-Ltn "evaṃ me sutaṃ", plus "vajrapada" with no
  language). `1.12` has an English (en) span on "testing". There is a `mantra`
  in `1.11` on "oṃ padme svāhā".
- Screen: each foreign span carries its `lang` attribute (`sa-Latn`,
  `bo-Latn`, `bo`, `zh`, `pi-Latn`, or none) and its foreign styling. The
  mantra shows its mantra styling.
- Do: in `1.12`, mark "great compassion" as foreign Sanskrit (Sa-Ltn) and
  Save.
- Stored: `1.12` has one new `span` row over "great compassion" with
  the foreign style and language Sa-Ltn. The existing en span is unchanged.
- Do: mark "great compassion" in `1.1` as a mantra and Save.
- Stored: `1.1` has one `mantra` row over it.

### ED-MRK-03 Upright pipes and typography (D)

- Pipe-not-italic: a `|` inside italic text renders upright.
  - Do: in `1.1`, type "lotus|pond" inside the italic span.
  - Screen: the `|` character renders with `font-style: normal`, while the
    letters on each side stay italic.
  - Stored: the passage `content` contains the `|`, and the italic `span` row
    still covers the whole of "lotus|pond". The upright pipe is only how it
    is displayed, not a separate annotation.
- Typography replacements: typed punctuation is replaced as you type.
  - Do: at the end of `1.12`, type a space, two hyphens, a space, and `"quoted"`.
  - Screen and stored: `content` ends with "— “quoted”". The double hyphen
    becomes an em dash and the straight quotes become curly ones.
