# Blocks (ED-BLK)

Blocks are chosen from the bubble menu's node selector or from the slash menu.
Each block type stores its own annotation, which covers the block's text.

### ED-BLK-01 Block types (D + J)

- Fixture, already seeded:
  - heading: `1.6` "Verses on the Six Perfections" (`heading` 0–29)
  - line group: `1.2` (4 lines) and `1.3` (3 lines)
  - quote: `1.4` (`blockquote` around a paragraph), and `1.5` (`blockquote` around a line group)
  - trailer: `2.141`
- Screen: `1.6` renders as a heading, `1.2` renders as four separate lines,
  `1.4` and `1.5` render indented as quotations, and `2.141` renders as a trailer.
- Do: in `1.12`, change the paragraph to each of Heading 1, Heading 2, Heading 3,
  Quote and Trailer in turn with the node selector, saving after each.
- Stored: after each save, `1.12` has one block annotation of the chosen
  type over its whole text (`heading` with the matching level for headings,
  `blockquote`, `trailer`), and no `paragraph` annotation over the same range,
  except that a quote keeps the `paragraph` it wraps, as `1.4` does.
- Do: change it back to Text and Save.
- Stored: `1.12` has its `paragraph` annotation again, and no `heading`,
  `blockquote` or `trailer` row.
- J: the node selector lists Text, Heading 1–3, Line group, Quote and Trailer,
  and it marks the current block type.

### ED-BLK-02 Lists (D)

- Fixture: `1.7` is a bullet list (`list`, 6 `list-item`s, indented). `1.8` is a
  numbered list (4 items).
- Screen: `1.7` shows 6 bullets and `1.8` shows items numbered 1–4.
- Do: put the caret at the end of the last item of `1.8`, press Enter, type
  "Fifth, rejoice.", then Save.
- Stored: `1.8` has 5 `list-item` rows whose ranges tile the list with no gap,
  and its `list` row covers all five. The last item's text is "Fifth, rejoice."

### ED-BLK-03 Tables (D)

- Fixture: `1.9` is the heading "Table 1. The six perfections and their
  opposites", and `1.10` is a `table` with one header row (Perfection,
  Sanskrit, Opposite) and three data rows.
- Screen: `1.10` renders as a table of 4 rows × 3 cells with the header row
  styled as a header. The first data row reads Generosity | dāna | Avarice.
- Do: change "Avarice" to "Stinginess" and Save.
- Stored: `1.10` still has 1 `table`, 4 `table-body-row`, 3
  `table-body-header` and 9 `table-body-data` rows. The cell that held
  "Avarice" now covers "Stinginess", and the ranges after it shift by the
  length change.

### ED-BLK-04 Text align (D)

- Fixture: `h.1` is centred, `i.6` right-aligned, `i.4` justified, and the
  `t.` heading is centred.
- Screen: each block's computed `text-align` is `center`, `right`, `justify`
  and `center` respectively.
- Do: set `1.12` to centred with the bubble menu and Save.
- Stored: `1.12`'s paragraph carries the center alignment, and after a reload it
  renders centred. The other alignments are unchanged.

### ED-BLK-05 Word break (D)

- Fixture: `i.5` has `word-break: break-all` and contains one unbroken URL of
  about 90 characters.
- Screen: `i.5` wraps inside its column. Its `scrollWidth` is not larger
  than its `clientWidth`.
- Do: set `i.4` to break-all with the bubble menu and Save.
- Stored: `i.4`'s paragraph carries break-all. `i.5` is unchanged.

### ED-BLK-06 Leading space and indent (D)

- Fixture: there is leading space on paragraph `i.6`, heading `1.6`, line group
  `1.2` and quote `1.4`, and an indent on paragraph `i.4`, line group `1.3`,
  list `1.7` and quote `1.4`.
- Screen: each of these blocks has extra space above it or an indent,
  compared with a neighbouring block that has neither.
- Do: make an unrelated text edit in each of these passages and Save.
- Stored: each keeps its `leading-space` (zero-length at 0) and `indent`
  rows.
- Do: add an indent to `1.12` with the bubble menu and Save.
- Stored: `1.12` has an `indent` row over its paragraph.

### ED-BLK-07 Images and audio (D)

- Fixture: `1.1` ends with a zero-length `image` (src
  `/images/lotus-pond.png`). `1.11` ends with a zero-length `audio` (a public
  mp3 URL).
- Screen: `1.1` shows the image, loaded (`naturalWidth > 0`). `1.11` shows
  an audio player whose source is that URL.
- Do: edit a word in `1.1` and in `1.11`, then Save.
- Stored: the `image` and `audio` rows are still there, still zero-length at
  the end of their passages (moved by the length change), with the same
  `content`.
