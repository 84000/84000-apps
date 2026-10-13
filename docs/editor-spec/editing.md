# Editing behaviour (ED-EDT)

### ED-EDT-01 Undo and redo across passages (D)

- Fixture: `1.11`, `1.12`, `1.13`.
- Do: type "X" at the end of `1.11`, then "Y" at the end of `1.12`. Press undo
  twice, then Save if the Save button is shown.
- Screen and stored: both passages read as seeded, and nothing changes in
  the database.
- Do: press redo twice and Save.
- Stored: `1.11` ends with "X" and `1.12` ends with "Y".
- Do (fresh fixture): split `1.12` with Enter twice, then undo, then Save.
- Stored: nothing changes. There is no new passage, and `1.12` is as seeded.
- Do (fresh fixture): merge `1.13` into `1.12` with Backspace, then undo, then
  Save.
- Stored: nothing changes.
- Do (fresh fixture): delete `1.12` from its label menu, then undo, then Save
  and reload.
- Stored: `1.12` is still there, with all of its annotations.

### ED-EDT-02 Copy and paste (D + J)

- Fixture: `2.5` has a glossary instance on "great compassion". `1.12` has
  none.
- Do: select "great compassion" in `2.5`, copy it, and paste it at the end of
  `1.12`. Then Save.
- Stored: `1.12`'s text ends with "great compassion", and a new
  `glossary-instance` row covers the pasted text with the same term uuid as in
  `2.5`. `2.5` is unchanged.
- Do: copy the italic "lotus pond" from `1.1` and paste it into the same
  passage. Then Save.
- Stored: two italic `span` rows in `1.1`, one per copy.
- Do: paste the HTML `<p>plain <b>bold</b> <i>italic</i></p>` from the
  clipboard at the end of `1.12`, and Save.
- Stored: `1.12` gains "plain bold italic", with a bold `span` on "bold"
  and an italic `span` on "italic".
- J: copying from the editor into another app (a plain text editor, a word
  processor) gives readable text with the passage breaks kept. Pasting from
  a word processor keeps bold and italic, and drops styling the editor does
  not support.

### ED-EDT-03 Select and delete across passages (D)

- Fixture: `1.11` "When the assembly heard the mantra oṃ padme svāhā recited
  aloud, the sound filled the ten directions." and `1.12` "Mañjuśrī
  explained…".
- Do: select from just after "recited aloud" in `1.11` to just before "is used
  here" in `1.12`, press Delete, and Save.
- Screen: one passage remains where the two were: `1.11`, reading
  "When the assembly heard the mantra oṃ padme svāhā recited aloudis used
  here…". Later labels move down by one.
- Stored: matches the screen. `1.12`'s row is gone, and the `mantra` row on
  `1.11` and the remaining part of `1.12`'s annotations are kept.

### ED-EDT-04 Arrow keys across passage boundaries (J)

- Fixture: `1.11`, `1.12`.
- Do: put the caret at the end of `1.11` and press ArrowRight. Put it on the
  last line of `1.11` and press ArrowDown.
- Screen: the caret moves to the start, or the first line, of `1.12`. ArrowLeft
  and ArrowUp from the start of `1.12` move it back into `1.11`. Shift+Arrow
  extends a selection across the boundary.
