# Slash menu (ED-SLH)

### ED-SLH-01 Slash menu entries (D + J)

- Fixture: an empty paragraph at the end of `1.12` (press Enter once at its end).
- Do: type `/`.
- Screen: the menu lists Text, Passage, Heading 1, Heading 2, Heading 3,
  Abbreviation, Mention, Bullet List, Numbered List and Quote, in that order.
  The stack editor lists Abbreviation in every tab, not only Abbreviations.
  That is current behaviour and should change. Typing more letters narrows the
  list (`/head` shows only the headings).
- Do: choose each entry in turn on a fresh empty paragraph, and Save.
- Stored: the same rows as the matching block or annotation item:
  - Heading 1–3, Quote: ED-BLK-01
  - Text: the new block is a `paragraph`
  - Bullet List, Numbered List: one `list` row with one `list-item` row, and
    no `paragraph` inside the item (the same shape as the seeded lists)
  - Passage: ED-STR-01
  - Mention: ED-ANN-03
  - Abbreviation: ED-ANN-07
- Known: open in the stack editor: choosing Text leaves the typed `/text` in the
  passage (DEV-855). A list made from the menu also stores a `paragraph` row
  inside its item (DEV-856).
- J: the menu opens next to the caret, Up/Down/Enter choose an entry, Escape
  closes it, and choosing one removes the typed `/…`.
