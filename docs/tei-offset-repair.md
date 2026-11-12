# Repair annotation offsets after a legacy TEI ingest

The legacy TEI/XML ingest (see [Passage and Annotation Writes](data-flow.md#passage-and-annotation-writes))
writes some annotations one character late, or one past the end of the passage.
The editor and reader can't place those rows. Three Supabase SQL editor queries
find and repair them. Run them after every legacy TEI ingest.

## The queries

They live in the infra repo. Save each one in the production project's SQL
editor as a shared snippet with the name below, and paste in the current file
again whenever the file changes.

| Snippet                     | Source                                                                                                                        | What it does                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `TEI offset repair: report` | [`infra/scripts/tei-offset-repair-report.sql`](https://github.com/84000/infra/blob/main/scripts/tei-offset-repair-report.sql) | Lists the rows the apply would move, and the out-of-range rows it would leave. Writes nothing. |
| `TEI offset repair: apply`  | [`infra/scripts/tei-offset-repair-apply.sql`](https://github.com/84000/infra/blob/main/scripts/tei-offset-repair-apply.sql)   | Backs up and moves those rows. Returns a run id.                                               |
| `TEI offset repair: revert` | [`infra/scripts/tei-offset-repair-revert.sql`](https://github.com/84000/infra/blob/main/scripts/tei-offset-repair-revert.sql) | Puts back the offsets a run changed, given its run id.                                         |

Each query has one line ending in `-- @param`. Leave its `NULL` to cover every
work, or replace the `NULL` with a work's uuid in quotes, such as
`'20b7fcb1-d134-4a22-80f5-b9efe9444e46'::uuid`, to cover only that work. In the
revert, that line takes the run id instead.

## Steps

1. **Report.** Run the report for the work you just ingested. Each row has a
   `rule`:
   - `passage-shifted`, `marker-past-end`, `span-one-late`: the apply moves
     the row from `start`/`end` to `new_start`/`new_end`. Spot-check a few
     against the passage text.
   - `needs-decision`: the apply leaves the row alone.

   If the report is empty, you are done.

2. **Apply.** Run the apply with the same `@param` value. Run the whole
   snippet at once. It either repairs every row the report listed or, if a
   check fails, raises an error and writes nothing. It returns one row.
   **Write down its `run_id`**, with the date and the work, for example in the
   ingest's ticket. You need the `run_id` to undo the run. A `run_id` of `NULL`
   means there was nothing to repair.
3. **Needs-decision rows.** Run the report again. Only `needs-decision` rows
   should be left. Send them (the report's rows, as CSV) to a developer.
   They're not safe to move automatically: the text they mark may have
   changed, or the row may need deleting.
4. **Done** when the report for the work comes back empty, which happens once
   a developer has dealt with the needs-decision rows.

## Undo

Run the revert with the run's `run_id` on its `@param` line. It restores every
row of the run that is still where the run left it. It skips rows that were
deleted or edited since then, and reports them as `skipped-deleted` or
`skipped-changed`. Running it twice does nothing the second time
(`already-reverted`).

## Notes

- The backups are in `repair.tei_offset_repair_backup`, one row per changed
  annotation and run, with the whole row as it was before. The `repair` schema
  isn't exposed through the API, and only `postgres` can read it.
- Editing `passage_annotations` marks the work's draft as changed, as any
  annotation edit does. A published copy isn't changed. Republish the work if
  its readers should see the repair.
- Offsets are counted in UTF-16 units, as in the editor. The rules are
  described in the header of the report query.
