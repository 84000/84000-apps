# Annotations (ED-ANN)

Annotations that link text to other content: glossary terms, mentions, links,
endnotes, comments and abbreviations, and the Toh scoping that applies to all
of them.

### ED-ANN-01 Glossary instance: add (D)

- Fixture: `1.1` ("…this pond is a sign of great compassion.") has no glossary
  instance. Term _great compassion_ is seed key `glossary:3:en`, the same uuid
  the seeded instances on `2.5` carry.
- Do: select "great compassion" in `1.1`, choose Glossary in the bubble menu,
  pick _great compassion_, and Save.
- Screen: the text shows the glossary-instance styling, and hovering it shows
  the term's hover card.
- Stored: `1.1` has exactly one new `glossary-instance` row covering "great
  compassion", whose `content[0].uuid` is the _great compassion_ glossary uuid.
  `1.1`'s `paragraph`, italic `span` and zero-length `image` are unchanged.
  No other passage changes.
- Note: hover cards are behind the `translation-hover-cards` flag, which the
  e2e suite does not turn on, so its test does not check the hover card.

### ED-ANN-02 Glossary instance: remove (D)

- Fixture: `2.5` has one `glossary-instance` on "great compassion" and a
  zero-length glossary `mention` of _bodhisattva_ at the end.
- Do: hover the instance, remove it from its hover card (the bubble menu has
  no remove), and Save.
- Screen: the glossary styling is gone, and the _bodhisattva_ mention still
  shows.
- Stored: `2.5` has no `glossary-instance` row. Its `mention` and `paragraph`
  rows are unchanged.
- Note: needs the `translation-hover-cards` flag, which the e2e suite does not
  turn on, so its test is skipped.

### ED-ANN-03 Mention (D + J)

- Fixture, already seeded: the passage mentions `p.1` → `1.12` and `1.12` → `2.1`;
  in `i.3`, a quoted mention of toh251 passage 1.2, a work mention of toh251, and
  a bibliography mention; and the glossary mention at the end of `2.5`.
- Screen: each mention renders as a chip with its target's display text.
- Do: at the end of `1.4`, type a space (the `/` and `@` triggers need one
  before them) and insert a mention of passage `2.1`, once from each
  entry point (the bubble menu, the slash command "Mention", and the advanced
  overlay), saving after each one and removing it before the next.
- Stored: each time, `1.4`'s content gains only the space, and it has one new
  zero-length `mention` row at the insertion point whose content names passage `2.1`'s uuid. All three entry
  points store the same shape.
- J: each entry point's search finds passages, works and glossary terms, and
  the chosen target's text shows in the chip.

### ED-ANN-04 External and internal links (D)

- Fixture: `ac.1` has an external `link` on "84000.co". `p.1` has an
  `internal-link` to passage `2.1`.
- Do: select "dependent arising" in `1.4`, add the external link
  `https://example.org/`, and Save.
- Stored: `1.4` has one `link` row covering "dependent arising" with that
  href.
- Do: the editor has no way to add a new internal link, only to edit one. Hover
  `p.1`'s internal link, edit it from its hover card to point at passage
  `1.12`'s uuid, and Save.
- Stored: `p.1`'s `internal-link` row still covers "Mañjuśrī rises to speak",
  and its content names `1.12`'s uuid.
- Note: editing the link needs the `translation-hover-cards` flag, which the
  e2e suite does not turn on, so that test is skipped.

### ED-ANN-05 Endnote link, and undoing it (D)

- Fixture: endnote links `n.1` (in `i.1`), `n.2` (`i.2`), `n.3` (`1.2`) and
  so on. `1.1` has no endnote link.
- Do: put the caret at the end of `1.1` and insert an endnote.
- Screen: a link marker appears at the caret. In the Endnotes tab, a new empty
  note appears between `n.2` and the note that was `n.3`, labelled `n.3`. The
  notes after it are relabelled `n.4`–`n.14`, and the per-Toh pair that was
  `n.5` is now `n.6` in both Tohs.
- Do: type "A new note." into the new note and Save.
- Stored: one new `endnotes` passage with that text, between the old `n.2` and
  `n.3` by `sort`. `1.1` has one zero-length `end-note-link` at its end whose
  content names the new note. The stored labels match the screen.
- Do (on a fresh fixture): insert an endnote at the end of `1.1`, press undo
  once, then Save.
- Screen: the link marker and the new note are both gone, and the labels are as
  seeded.
- Stored: nothing changed, with no new passage and no new annotation.

### ED-ANN-06 Comments (D)

- Fixture: there are six threads. `t4` on `s.1` covers "the six perfections"
  and is tagged `terminology`. `t3` on `2.100` covers "nirvāṇa" and is tagged
  `pending`. `t1` on `1.13` covers "great compassion" and has two replies, one
  tagged `pending`.
- Do: select "Mañjuśrī explained" in `1.12`, choose Comment in the bubble menu,
  write "Check this.", and post it.
- Screen: the selection shows comment highlighting, and the comments panel
  lists the new thread at that anchor.
- Stored: one new row in `comments` with `parent_uuid` null and
  `entity_uuid` = `1.12`'s uuid, whose content contains "Check this.". After
  a Save (the anchor reaches the server with the next passage save), one
  `comment` annotation on `1.12` covering "Mañjuśrī explained" whose
  `content[0].uuid` is the comment's uuid.
- Do: tag the new comment `pending`.
- Screen: with the panel filter `?commentTag=pending`, the panel lists `t3`,
  `t1`'s tagged reply and the new comment.
- Do: remove the new comment from the comments panel.
- Stored: its `comment` annotation is gone, and the comment row is deleted or
  marked deleted, so the panel no longer lists it.

### ED-ANN-07 Abbreviation and has-abbreviation (D)

- Fixture: the five entries in the Abbreviations tab (see ED-TYP-05).
- Do: in the Abbreviations tab, add a new passage after the "Toh" entry, type
  `/`, choose Abbreviation, and Save.
- Screen: the new entry shows the placeholder key "A" and the expansion
  "Abbreviation", styled like the seeded entries.
- Stored: one new `abbreviations` passage after the "Toh" entry by `sort`, with
  an `abbreviation` row covering "A" and a `has-abbreviation` row covering
  "Abbreviation".
- Do: change the key to "Z" and the expansion to "Zeta Kangyur", then Save.
- Stored: the rows cover "Z" and "Zeta Kangyur".

### ED-ANN-08 Toh-scoped annotations (D)

- Fixture, all in one work:
  - `1.5` has an emphasis `span` on "not stained" scoped to `toh90001`, and
    two end-note links at its end, one per Toh, both to `n.5`.
  - `n.5` has a different text for each Toh.
  - The body title `t.` has one heading per Toh: "…(Toh 90001)" and
    "…(Toh 90002)".
- Do: open the editor with `?toh=toh90001`.
- Screen: the emphasis in `1.5` shows, the body title reads "(Toh 90001)", and
  `n.5`'s hover card or Endnotes entry reads "…image of the lotus."
- Do: switch the Toh to `toh90002` with the Toh switcher, without reloading.
- Screen: the emphasis in `1.5` is gone, the body title reads "(Toh 90002)",
  and `n.5` reads "…moon reflected in water."
- Do: edit `1.5` while `toh90002` is active, and Save.
- Stored: the `toh90001`-scoped span is still stored with `toh = 'toh90001'`,
  and both end-note links keep their `toh`. Saving under one Toh does not drop
  the other Toh's annotations.
