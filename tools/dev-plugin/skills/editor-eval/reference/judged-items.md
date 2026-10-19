# The judged items

The J part of each item, with what to probe and what passes. The spec item
is the authority; if this file and the spec disagree, follow the spec and say
so in the report's `note`.

## ED-NAV-01 Hover cards (D + J)

- The test checks each card's text. The J part: hover each target (the
  glossary instance in 2.5, the end-note link at the end of 1.20, the mention
  at the end of 1.12, the internal link in p.1) with and without the caret in
  the passage.
- Probe: the visible hover card (`div.z-100 > div.bg-popover`), its bounding
  box against the hovered element's, and whether it is gone after the pointer
  moves away. With the `translation-hover-cards` flag off, no card ever opens:
  that is a setup problem, not a fail.
- Pass: the card sits next to the hovered text without covering it, and closes
  when the pointer leaves. A uuid on an internal-link card is expected (legacy);
  on any other card it means incomplete local data, not a fail.

## ED-EDT-04 Arrow keys across passage boundaries (J)

- Caret at the end of 1.11, ArrowRight; caret on 1.11's last line, ArrowDown;
  then ArrowLeft and ArrowUp from the start of 1.12; then Shift+ArrowRight
  across the boundary.
- Probe: after each key, which row's editor holds the focus
  (`document.activeElement.closest('[data-stack-passage]')`) and the
  selection's anchor and focus offsets.
- Pass: the caret moves into 1.12 and back into 1.11, and Shift+Arrow gives a
  selection that spans both passages. A selection the browser shows but the
  editor drops (nothing selected after the key) is a fail.

## ED-STR-04 Passage label menu (D + J)

- J part: open the menu on 1.12's label; choose Copy Link.
- Probe: the menu's items; the clipboard text
  (`navigator.clipboard.readText()`); then open that URL in a new page and
  read which row is at the top of the main panel.
- Pass: Copy Link, Edit Label, View Attributes and Delete are listed, and the
  copied URL opens the editor scrolled to 1.12.

## ED-BLK-01 Block types (D + J)

- J part: select text in 1.12 and open the bubble menu's node selector.
- Probe: the selector's entries and which one is marked current; repeat in
  1.6 (a heading) and 1.4 (a quote).
- Pass: Text, Heading 1–3, Line group, Quote and Trailer are listed, and the
  marked entry matches the block (Text in 1.12, the heading level in 1.6,
  Quote in 1.4).

## ED-MRK-01 Text styles (D + J)

- J part: select "ordinary" in 1.12. Apply bold from the bubble menu and read
  which style buttons show as active; remove it. Then press the bold, italic
  and underline shortcuts (`ControlOrMeta+b`, `+i`, `+u`) one at a time.
- Probe: the bubble menu buttons' pressed/active state, and the marks on
  "ordinary" in the DOM after each shortcut. Save after a shortcut and query
  `passage_annotations` for 1.12.
- Pass: the bubble menu shows exactly the styles applied, each shortcut
  toggles the same mark the button does, and the stored row matches ED-MRK-01's
  Stored line.

## ED-ANN-03 Mention (D + J)

- J part: from each entry point (bubble menu, slash command "Mention", the
  advanced overlay), open the mention search at the end of 1.4 (type a space
  first: the `/` and `@` triggers need one) and search for
  a passage ("2.1"), a work ("toh251") and a glossary term ("great
  compassion").
- Probe: the result list's entries for each search; after choosing 2.1, the
  chip's text.
- Pass: each entry point finds all three kinds, and the chip shows 2.1's
  display text. Restore the fixture afterwards.

## ED-EDT-02 Copy and paste (D + J)

- J part: copy 1.11–1.12 from the editor and read the clipboard as plain text
  and as HTML. Paste HTML with unsupported styling (colour, font size, a
  table) at the end of 1.12.
- Probe: the clipboard contents; the pasted DOM; after Save, the stored rows.
- Pass: the copied plain text is readable with a break between passages;
  bold and italic survive the paste and the unsupported styling is dropped
  without an error. Pasting from a real word processor needs a human: mark
  that part in `note` and leave the item `blocked` only if nothing else could
  be checked.

## ED-SLH-01 Slash menu entries (D + J)

- J part: on an empty paragraph at the end of 1.12, type `/`.
- Probe: the menu's position against the caret's
  (`getSelection().getRangeAt(0).getBoundingClientRect()`); the highlighted
  entry after ArrowDown and ArrowUp; whether Escape closes the menu; and the
  paragraph's text after choosing an entry with Enter.
- Pass: the menu opens next to the caret, Up/Down move the highlight, Enter
  chooses the highlighted entry, Escape closes the menu, and the typed `/…`
  is gone after a choice.
