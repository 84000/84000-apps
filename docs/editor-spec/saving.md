# Saving (ED-SAV)

These items state what a save leaves in the database and on screen. They do
not depend on how the save is carried out.

### ED-SAV-01 The Save button (D)

- Do: load the editor and click into `1.4` without typing.
- Screen: no Save button.
- Do: type one character in `1.4`.
- Screen: the Save button appears.
- Do: click Save.
- Screen: a "Content saved" toast appears, and the Save button is gone.
- The same holds for a first edit in each of the other tabs: `n.9`
  (Endnotes), `s.1` (Front) and the "D" entry (Abbreviations).
- Known: the button used not to appear for edits in the Translation tab
  (fixed).

### ED-SAV-02 Annotation round trip (D)

- Fixture: every hand-written passage: front matter, `h.1`, `pl.1`, `p.1`,
  `1.1`–`1.12`, `2.141`, `c.1`, `c.2`, `ap1.1`, `n.1`–`n.13`, and the
  abbreviation entries.
- Do: in each passage, type one character at the very end, then Save.
- Stored: each passage's content is its seeded text plus that character.
  Every seeded annotation is still stored with the same type and content,
  and a block, line, list item or cell that ends at the passage end is extended
  by one. Zero-length annotations at the end (`image`, `audio`, `end-note-link`,
  `mention`) either stay before the new character or move after it, as the
  editor places the caret, but are not lost. No annotation type disappears.
- Known: the stack editor adds a root `paragraph` row to passages whose
  stored data has none, so this item only checks that nothing is lost. Open
  (DEV-840): a save drops attributes the editor does not model, the link `title` on
  `ac.1` and the internal-link `toh`, `subtype`, `label` and `same_work` on
  `i.2` and `p.1`.

### ED-SAV-03 New, merged and deleted passages persist (D)

- Covered by the save-and-reload checks in ED-STR-01 (new), ED-STR-03 (merge)
  and ED-STR-04 (delete). This item exists so the Saving section lists them.

### ED-SAV-04 Edits typed during a save are kept (D)

- Fixture: `1.4`.
- Do: type "ZZBEFORE" at the end of `1.4` and click Save. While the save request
  is still in flight (held in the test), type " ZZDURING".
- Screen: once the first save finishes, the Save button is still shown.
- Do: click Save again.
- Stored: `1.4` ends with "ZZBEFORE ZZDURING".
- Known: an edit typed during a save used to be lost (fixed).

### ED-SAV-05 One save covers every tab (D)

- Do: edit `1.4` (Translation), `n.9` (Endnotes), `s.1` (Front) and the "D"
  entry (Abbreviations), then click Save once.
- Screen: one "Content saved" toast, and the Save button is gone.
- Stored: all four edits are stored.
- Known: Front tab edits used not to be saved (fixed).

### ED-SAV-06 A failed save can be retried (D)

- Do: edit `1.4`, make the server reject the save request (the test answers it
  with a 400 error), and click Save.
- Screen: an "Error saving content." toast, and the Save button is still shown.
- Stored: `1.4` is unchanged.
- Do: let requests through again and click Save.
- Stored: the edit is stored.
- A rejection is a known failure. A request that never gets an answer is
  `ED-SAV-10`.

### ED-SAV-07 Passages the user did not edit are not written (D)

- Fixture: `1.12` (it has a mention) and its neighbours.
- Do: load the editor, click into `1.12` and `1.11` without typing, then edit
  `1.4` and Save.
- Stored: only `1.4` changes. `1.11` and `1.12` and their annotations are
  exactly as seeded, including `updated_at` where the table has one.
- Known: an unedited passage that contains a mention used to be saved
  (fixed).

### ED-SAV-08 Overlapping annotations save (D)

- Fixture: `1.20` has a glossary instance on "great compassion". In `1.13`,
  thread `t1` is anchored on exactly the text of its glossary instance, "great
  compassion".
- Do: type at the end of `1.13`. In `1.20`, add a comment on "compassion is
  their" (part of the instance and the text after it), type at the end of
  `1.20`, and Save.
- Screen: "Content saved".
- Stored: both edits are stored. In `1.20`, the glossary instance is stored as
  one or more rows that together cover "great compassion", and the new comment
  rows together cover "compassion is their". `1.13`'s comment and glossary
  instance are unchanged.
- Known: overlapping annotations used to make the whole save fail (fixed).

### ED-SAV-09 Deleting an endnote does not bring its links back (D)

- Fixture: `n.6` is linked from the end of `1.20`.
- Do: delete `n.6` from its label menu and Save. Then edit `1.20` and Save
  again.
- Stored: no `end-note-link` on `1.20` or any other passage names `n.6`'s uuid,
  and `n.6`'s row is gone.
- Known: a later save used to write the link back. Passes in the stack
  editor.

### ED-SAV-10 A save whose outcome is unknown is read back (D)

- Do: edit `1.4`, make the save request fail without an answer (the test
  aborts the connection), and click Save.
- Screen: a toast says the save may have gone through, and the editor reloads
  the passages from the server instead of sending the save again.
- Stored: one save request at most; `1.4` is either unchanged or has the
  edit, and the editor shows what is stored.
- Known: this item is out of date. Since DEV-836, a save that only changed
  content is kept and sent again when its outcome is unknown ("could not be
  confirmed"); only a save that creates or deletes passages is read back. The
  test is skipped until the item is rewritten.
