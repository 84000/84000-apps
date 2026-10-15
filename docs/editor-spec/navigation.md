# Navigation (ED-NAV)

### ED-NAV-01 Hover cards (J)

- Fixture: the glossary instance in `2.5`, the end-note link at the end of
  `1.20` (to `n.6`), the passage mention at the end of `1.12` (to `2.1`), and the
  internal link in `p.1` (to `2.1`).
- Do: hover each one, first in a passage that has the caret and then in one
  that does not.
- Screen: a card appears each time:
  - glossary: the term _great compassion_ with its definition
  - endnote: the text of `n.6`, "This passage echoes the perfection of
    wisdom literature."
  - mention and internal link: the opening of `2.1`
- The check must read the card's own text in the visible DOM. Before calling a
  card missing, show that the same probe finds a card that is known to appear.

### ED-NAV-02 Clicking content links (D)

- Do: click the glossary instance in `2.5`.
- Screen: the glossary panel opens on _great compassion_.
- Do: click the end-note link at the end of `1.20`.
- Screen: the Endnotes tab opens in the side panel, scrolled to `n.6`.
- Do: click the internal link in `p.1`, and separately the mention at the end
  of `1.12`.
- Screen: the main panel scrolls to `2.1`, loading its page if needed, and
  `2.1` is in the viewport.

### ED-NAV-03 Deep links (D)

- Do: open the editor at `#<uuid of 2.100>`, a passage outside the first
  page.
- Screen: `2.100` is in the viewport once the page settles.
- Do: open a link with `?start=` and `?end=` set to a character range inside
  `1.12`.
- Screen: exactly that range is highlighted, and `1.12` is in view.
- Do: the same with the target in the right panel (an endnote such as `n.6`).
- Screen: the right panel opens on the Endnotes tab with `n.6` in view and the
  range highlighted.

### ED-NAV-04 Endnote back-references (D)

- Fixture: `n.6` is linked from the end of `1.20`.
- Do: open `n.6` in the Endnotes tab.
- Screen: it lists `1.20` as the passage that refers to it, and clicking that
  reference scrolls the main panel to `1.20`.
- Known: not checked yet against the stack editor.

### ED-NAV-05 Search and replace (D)

- Do: search the work for "Vulture Peak".
- Screen: results in `s.1`, `i.2`, `p.1` and the chapter heading `1.`.
  Selecting the `p.1` result opens the Translation tab scrolled to `p.1`.
- Do (fresh fixture): replace all "lotus pond" with "lily pond".
- Screen: `1.1` reads "lily pond" in the visible editor straight away, with
  no reload.
- Stored, after Save: `1.1`'s content has "lily pond", and its italic span
  still covers it.
- Known: replace-all not updating the visible stack editor has not been checked yet.

### ED-NAV-06 Comments panel jumps to anchors (D)

- Fixture: thread `t3` on `2.100` ("nirvāṇa", outside the first page) and
  thread `t6` on `1.110`, whose two anchor rows are on "perfection" and " of
  wisdom".
- Do: open the comments panel and click `t3`.
- Screen: the main panel scrolls to `2.100`, loading its page, and "nirvāṇa"
  is highlighted.
- Do: click `t6`.
- Screen: `1.110` is in view, and the whole of "perfection of wisdom" is
  highlighted.
- Do: click the unanchored thread `t5` (on `1.50`).
- Screen: it is listed under Unanchored, and clicking it scrolls to `1.50`
  without a highlight.

### ED-NAV-07 Long works: infinite scroll and scroll restore (D)

- Fixture: 281 translation passages, so loading needs at least three pages.
- Do: scroll the Translation tab to the bottom.
- Screen: every label from `1.1` to `2.141` appears exactly once, in order,
  with no gap and no repeat, and placeholders are replaced by text as pages
  arrive.
- Do: scroll to `1.80`, switch to the Front tab, then back to Translation.
- Screen: `1.80` is still at the same position, within one passage's
  height.
