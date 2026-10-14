# Slash menu (ED-SLH)

### ED-SLH-01 Slash menu entries (D + J)

- Fixture: an empty paragraph at the end of `1.12` (press Enter once at its end).
- Do: type `/`.
- Screen: the menu lists Text, Passage, Heading 1, Heading 2, Heading 3,
  Abbreviation, Mention, Bullet List, Numbered List and Quote, in that order.
  The stack editor lists Abbreviation in every tab, not only Abbreviations.
  Typing more letters narrows the list (`/head` shows
  only the headings).
- Do: choose each entry in turn on a fresh empty paragraph, and Save.
- Stored: the same rows as the matching block or annotation item:
  - Heading 1–3, Quote: ED-BLK-01
  - Text: the new block is a `paragraph`
  - Bullet List, Numbered List: one `list` row with one `list-item` row, and a
    `paragraph` row inside the item (seeded lists have none)
  - Passage: ED-STR-01
  - Mention: ED-ANN-03
  - Abbreviation: ED-ANN-07
- Known: open in the stack editor (new, not filed yet): choosing Text leaves
  the typed `/text` in the passage.
- J: the menu opens next to the caret, Up/Down/Enter choose an entry, Escape
  closes it, and choosing one removes the typed `/…`.
