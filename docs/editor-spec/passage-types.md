# Passage types (ED-TYP)

Every tab that holds passages loads and saves its own passage types.

### ED-TYP-01 Front tab (D)

- Fixture: `s.` `s.1` `s.2` (summary), `ac.` `ac.1` (acknowledgment), `i.`
  `i.1`–`i.6` (introduction).
- Do: open the Front tab.
- Screen: the 12 passages appear in sort order (10, 11, 12, 20, 21, 30–36),
  each header shown as a section heading above its passages. No body passage
  (`h.1`, `1.1`) appears in this tab.
- Do: type " Edited." at the end of `s.1`, then Save.
- Stored: `s.1`'s `content` ends with " Edited." Its `paragraph`
  annotation is extended to the new length, and its emphasis `span` and the
  `comment` anchor on "the six perfections" are unchanged. No other passage
  changes.

### ED-TYP-02 Translation tab (D)

- Fixture: body matter `h.` `h.1` `pl.` `pl.1` `p.` `p.1` `t.` `1.` `1.1`–`1.140`
  `2.` `2.1`–`2.141` `c.` `c.1` `c.2` `ap1.` `ap1.1`.
- Do: open the Translation tab and scroll to the end.
- Screen: the passages appear in sort order, with homage, prelude and
  prologue ahead of the body title `t.`, chapter headings `1.` and `2.`, then
  colophon and appendix. Every label from `1.1` to `1.140` and `2.1` to `2.141`
  appears exactly once. No front-matter, endnote or abbreviation passage
  appears in this tab.
- Do: edit `ap1.1` and Save.
- Stored: only `ap1.1` changes.

### ED-TYP-03 Compare tab (D)

- Fixture: as ED-TYP-02.
- Do: open the Compare tab.
- Screen: it lists the same passages as the Translation tab, in the same
  order, with a source column beside them (see [compare.md](compare.md)).

### ED-TYP-04 Endnotes tab (D)

- Fixture: `n.` and `n.1`–`n.13`. `n.5` has two rows, one per Toh.
- Do: open the Endnotes tab with `toh90001`, then with `toh90002`.
- Screen: the 13 notes appear in label order both times. `n.5` reads "In Toh
  90001 the verse ends with the image of the lotus." with `toh90001`, and "In
  Toh 90002 the verse ends instead with the moon reflected in water." with
  `toh90002`. Only one `n.5` shows at a time.
- Do: edit `n.9` and Save.
- Stored: only `n.9` changes.

### ED-TYP-05 Abbreviations tab (D)

- Fixture: `ab.` plus five entries with empty labels: "D Degé Kangyur",
  "H Lhasa (zhol) Kangyur", "K Peking (Kangxi) Kangyur", "S Stok Palace
  Kangyur", "Toh Tōhoku catalogue…". Each entry has an `abbreviation`
  annotation over the key and the space after it (`D `) and a
  `has-abbreviation` annotation over the expansion.
- Do: open the Abbreviations tab.
- Screen: the five entries appear in sort order, with the key and the expansion
  styled differently.
- Do: change "Degé Kangyur" to "Degé Kangyur (edited)" and Save.
- Stored: the D entry's `content` is "D Degé Kangyur (edited)". Its
  `abbreviation` row still covers "D ", and its `has-abbreviation` row covers
  "Degé Kangyur (edited)". The other four entries are unchanged.
