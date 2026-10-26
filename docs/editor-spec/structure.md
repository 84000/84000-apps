# Passage structure (ED-STR)

Creating, merging, relabelling and deleting passages. Labels are what the user
sees. `sort` is what orders passages in the database.

### ED-STR-01 New passage from the slash menu (D)

- Fixture: `1.12` (sort 1012), followed by `1.13` (sort 1013).
- Do: put the caret at the end of `1.12`, press Enter, type `/`, choose
  Passage, type "A new passage.", and Save.
- Screen: a new passage labelled `1.13` follows `1.12`. The old `1.13` and every
  later passage in chapter 1 move up by one (old `1.140` becomes `1.141`).
  Chapter 2 labels are unchanged.
- Stored: one new `translation` passage with that text, whose `sort` is
  between `1.12`'s and the old `1.13`'s. The stored labels in chapter 1 match the
  screen, and no two passages share a `sort`.

### ED-STR-02 New passage with Enter twice (D)

- Fixture: `1.2` is a line group with 7 annotations: a leading space, the line
  group, 4 lines, and the end-note link to `n.3`.
- Do: put the caret at the end of `1.2`, press Enter twice, type "After the
  verse.", and Save.
- Screen: a new passage labelled `1.3` follows `1.2`, and the later labels move
  up by one.
- Stored: `1.2` still has all 7 of its annotation rows, with the same uuids.
  The new passage has its own new block annotation and none of `1.2`'s uuids.
- Known: a split used to move the original's annotations onto the new
  passage (fixed). This item guards against that. Open in the stack editor
  (DEV-842): the text typed after the two Enters lands in a new line of `1.2`'s line
  group, and no passage is stored.

### ED-STR-03 Merge with Backspace (D)

- Fixture: `1.20` ends with the end-note link to `n.6` and has a glossary
  instance on "great compassion". `1.21` follows it.
- Do: put the caret at the very start of `1.21`, press Backspace, and Save.
- Screen: one passage labelled `1.20` holds both texts. The old `1.22` is now
  labelled `1.21`, and later chapter 1 labels move down by one. The view stays
  on the merged passage.
- Stored: the old `1.21` row is gone. `1.20`'s content is its own text followed
  by the old `1.21`'s. `1.20` keeps its glossary instance and its end-note link,
  and the old `1.21`'s annotations now sit on `1.20`, shifted by `1.20`'s old
  length. The stored labels match the screen, and chapter 2 is unchanged.
- Known: open in the stack editor (DEV-853): after the merge, `1.20` is no longer in
  view. Intermittent: the merged passage's row sometimes stays on
  screen after Backspace.

### ED-STR-04 Passage label menu (D + J)

- Fixture: `1.12`.
- Do: open the menu on `1.12`'s label.
- Screen: it offers Copy Link, Edit Label, View Attributes and Delete.
- Do: choose Copy Link.
- Screen: the clipboard holds a URL that opens the editor scrolled to `1.12`.
- Do: choose Edit Label, enter `1.12a`, and Save.
- Stored: the passage's `label` is `1.12a`.
- Do (fresh fixture): choose View Attributes.
- Screen: a dialog shows the passage's uuid, label and type `translation`.
- Do (fresh fixture): choose Delete, confirm, Save, and reload.
- Screen: `1.12` is gone, the old `1.13` is labelled `1.12`, and **the deleted
  passage does not come back after the reload**.
- Stored: no passage row with `1.12`'s uuid, and none of its annotations
  remain.
- Known: deleted passages used to come back after a reload (fixed). This item
  guards against that. Open in the stack editor (DEV-841): Edit Label changes the label
  on screen, but no Save button appears, so the new label is never stored.

### ED-STR-05 Labels renumber (D)

- Do: any of ED-STR-01, 02, 03 or 04 (Delete).
- Screen and stored: the labels of the section's numbered passages are the
  contiguous sequence `1.1`, `1.2`, … in `sort` order, with no gap and no
  repeat. The stored `sort` values keep the order the user sees. Editing one
  passage never rewrites another passage's `sort`.
- Known: a save used to rewrite `sort` from the loaded page's index,
  reordering passages (fixed).

### ED-STR-06 Endnote labels across Toh variants (D)

- Fixture: `n.5` has one row per Toh with the same label and sort.
- Do: any change that renumbers the endnotes (ED-ANN-05 inserts a note before
  it), and Save.
- Stored: both `n.5` rows get the same new label (`n.6`) and keep sharing one
  `sort`. Under each Toh, the Endnotes tab shows the note with that label.
