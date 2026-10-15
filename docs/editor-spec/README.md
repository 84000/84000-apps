# Studio editor feature spec

What the studio editor must do, written so it does not depend on which editor
implementation is running. Each item says what a user does, what they then see,
and what is stored in the database. None of it names a component, an extension
or a save function, so an item stays true while the code under it changes.

- **Deterministic items (D)** have one exact answer: the rows stored after a
  save, the labels on screen, whether a passage comes back after a reload. Each
  has a Playwright test in `apps/web-main-e2e`, run locally against the local
  Supabase stack.
- **Judged items (J)** need someone to drive the UI and judge the result: how a
  menu looks, whether a hover card shows the right thing, how the keyboard
  feels, pasting from another app. The `editor-eval` skill in the `84000-dev`
  developer plugin (`tools/dev-plugin`) drives these in a browser.

An item marked **D + J** has a deterministic outcome that the test asserts, plus
an interaction that the skill also walks through.

## The fixture: toh90001

Every item runs against the synthetic test work _The Noble Sūtra of the
Testing Lotus_, work `f09e7249-07a1-496e-8662-665e80f5461c`, which covers both
**Toh 90001** and **Toh 90002**. The seed files are in
`infra/supabase/seed/toh90001_*.sql`, and each file's header has a coverage map.

- Editor: `/translations/editor/toh90001` (switch Toh with `?toh=toh90002`).
- Hand-written feature passages: front matter `s.1–s.2`, `ac.1`, `i.1–i.6`;
  body `h.1`, `pl.1`, `p.1`, `1.1–1.12`, `2.141`, `c.1–c.2`, `ap1.1`;
  endnotes `n.1–n.13` (with `n.5` as a per-Toh pair); and five abbreviation entries.
- Generated passages `1.13–1.140` and `2.1–2.140` carry a paragraph, glossary
  instances and, on a few of them, end-note links.
- There are 281 translation passages, so the stack loads at least three pages of 100.

Uuids are deterministic. For seed key `k`:

```sql
overlay(overlay(md5('dev803:' || k) placing '4' from 13) placing '8' from 17)::uuid
```

Keys used here: `passage:<label>` (e.g. `passage:1.12`), `passage:n.5:toh90001`,
`passage:ab:<n>`, and `glossary:<n>:en` for a glossary term
(`glossary:3:en` is _great compassion_).

Items name text, not offsets. "The glossary instance on 'great compassion' in
2.5" means the row whose `[start, end)` covers exactly that text in that
passage's stored `content`.

## Conventions

- **"Stored"** means after clicking Save and reloading the page, as shown by a
  query on `passages`, `passage_annotations` or `comments`. The editor's own
  claim that something worked is not evidence.
- **"Unchanged"** means the same rows with the same type, range and content,
  ignoring `updated_at`.
- **Screen checks** use the visible copy of an element. web-main renders a
  hidden mobile layout and force-mounted inactive tabs, so every passage
  exists more than once in the DOM.
- **A missing element is only a failure** once the same check has been seen
  to find the element in a case where it is known to be present.
- **Labels and sorts**: after any structural change, the labels in a section
  are the contiguous sequence shown on screen, and no two passages of the work
  share a `sort` unless they are per-Toh variants of one passage.
- The **toh** is `toh90001` unless an item says otherwise.
- Every test starts from the seeded state. The restore is
  `make restore-test-work` in `infra`, which reloads toh90001 without a
  `db reset`.

## Item format

```
### ED-<SECTION>-<nn> Title  (D | J | D + J)

- Fixture:   passages, Toh and seeded rows involved
- Do:        what the user does
- Screen:    what the user then sees
- Stored:    the rows after save + reload
- Known:     a linked issue when the item is known to fail today
```

Item IDs are stable and never reused. A deterministic test puts its ID at the
start of its title (`test('ED-ANN-01 …')`), and `apps/web-main-e2e` checks that
every D item has a test and every test names a real item.

## Sections

| File                                 | IDs                       |
| ------------------------------------ | ------------------------- |
| [passage-types.md](passage-types.md) | ED-TYP                    |
| [blocks.md](blocks.md)               | ED-BLK                    |
| [marks.md](marks.md)                 | ED-MRK                    |
| [annotations.md](annotations.md)     | ED-ANN                    |
| [slash-menu.md](slash-menu.md)       | ED-SLH                    |
| [structure.md](structure.md)         | ED-STR                    |
| [editing.md](editing.md)             | ED-EDT                    |
| [navigation.md](navigation.md)       | ED-NAV                    |
| [compare.md](compare.md)             | ED-CMP                    |
| [saving.md](saving.md)               | ED-SAV                    |
| [future.md](future.md)               | ED-FUT (not yet required) |

## Changing the spec

Add a new item with the next free number in its section. When behaviour
changes on purpose, update the item's expected result in the same PR as the
code change. When an item is known to fail, link the issue under **Known**,
and mark its test `test.fail()` so the run stays green and starts failing
once the bug is fixed.
