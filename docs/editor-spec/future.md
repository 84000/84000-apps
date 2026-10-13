# Future items (ED-FUT)

Features that are planned but not built yet. They have IDs so that adding a
feature means filling in its expected result and moving the item to its
section, without inventing new IDs. Nothing tests these yet.

### ED-FUT-01 Drag a passage to move it (not yet required)

- Planned in [DEV-833](https://linear.app/84000/issue/DEV-833).
- Sketch: dragging `1.12` above `1.11` shows it there, relabels both, and
  after Save their `sort` values are swapped while their content and
  annotations are unchanged.

### ED-FUT-02 Warn before deleting a referenced passage (not yet required)

- Planned in [DEV-834](https://linear.app/84000/issue/DEV-834).
- Sketch: deleting `2.1`, which is the target of the internal link in `p.1` and
  the mention in `1.12`, first shows a warning that lists those two references.
  Cancelling leaves everything as it was.
