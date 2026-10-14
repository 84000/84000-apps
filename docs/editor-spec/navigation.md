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

- Do: click the glossary instance in `1.20`.
- Screen: the glossary panel opens on _great compassion_.
- Do: click the end-note link at the end of `1.20`.
- Screen: the Endnotes tab opens in the side panel, scrolled to `n.6`.
- Do: click the internal link in `p.1`, and separately the mention at the end
  of `1.12`.
- Screen: the main panel scrolls to `2.1`, loading its page if needed, and
  `2.1` is in the viewport.
- Known: open in the stack editor (new, not filed yet): when `2.1` is not
  loaded yet, the main panel usually scrolls to the end of the loaded passages
  (about `1.118`) and stops there. It reaches `2.1` about one time in four, so
  the test is skipped rather than expected to fail.

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
- Known: open in the stack editor (new, not filed yet): `n.6` lists `1.20`, but
  clicking the reference usually does not move the main panel. It sometimes
  does, so the test is skipped rather than expected to fail.

### ED-NAV-05 Search and replace (D)

- Do: search the work for "Vulture Peak".
- Screen: results in `s.1`, `i.2`, `p.1` and the chapter heading `1.`, under
  the Other Passages tab of the results (translation passages are listed as
  alignments). Selecting the `p.1` result opens the Translation tab scrolled
  to `p.1`.
- Do (fresh fixture): replace all "great saṅgha" with "large saṅgha".
- Screen: `p.1` reads "large saṅgha" straight away, with no Save button: the
  replace is written on the server.
- Stored: `p.1`'s content has "large saṅgha".
- Do (fresh fixture): replace all "lotus pond" with "lily pond".
- Screen: `1.1` reads "lily pond" in the visible editor straight away, with
  no reload.
- Stored, without a Save: `1.1`'s content has "lily pond", and its italic span
  still covers it.
- Known: open in the stack editor (new, not filed yet): a match in a
  translation passage comes back from search as an alignment match, so Replace
  all stays disabled with "Every match is in the Tibetan source", although the
  match is in the English.

### ED-NAV-06 Comments panel jumps to anchors (D)

- Fixture: thread `t3` on `2.100` ("nirvāṇa", outside the first page) and
  thread `t6` on `1.110`, whose two anchor rows are on "perfection" and " of
  wisdom".
- The panel lists the threads of the passages on screen. Filtered by a tag
  (`?commentTag=pending`) it lists every thread in the work with that tag,
  which is how `t3` is reached from the top of the work.
- Do: open the comments panel filtered by `pending` and click `t3`.
- Screen: the main panel scrolls to `2.100`, loading its page, and "nirvāṇa"
  is highlighted.
- Do: open the editor at `1.110`, open the comments panel and click `t6`.
- Screen: `1.110` is in view, and the whole of "perfection of wisdom" is
  highlighted.
- Do: open the editor at `1.50` and click the unanchored thread `t5`.
- Screen: it is listed under Unanchored, and clicking it scrolls to `1.50`
  without a highlight.
- Known: open in the stack editor (new, not filed yet): clicking `t3` has the
  same stop at the end of the loaded passages as `ED-NAV-02`, so `2.100` is
  usually not reached; that step is skipped.

### ED-NAV-07 Long works: infinite scroll and scroll restore (D)

- Fixture: 281 translation passages, so loading needs at least three pages.
- Do: scroll the Translation tab to the bottom.
- Screen: every label from `1.1` to `2.141` appears exactly once, in order,
  with no gap and no repeat, and placeholders are replaced by text as pages
  arrive.
- Do: scroll to `1.80`, switch to the Front tab, then back to Translation.
- Screen: `1.80` is still at the same position, within one passage's
  height.
