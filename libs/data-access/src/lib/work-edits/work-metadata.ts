import { v4 as uuidv4 } from 'uuid';
import { titleSlotKey } from '../import-preview';
import { rolledBack } from '../passage/save/commit';
import type { DataClient } from '../types';
import { expectMismatch } from './expect';
import type {
  GroupCommit,
  GroupPlan,
  WorkEditWarning,
  WorkMetadataChanges,
  WorkMetadataOp,
} from './types';

/** The folio annotation fields an op may patch. */
const FOLIO_FIELDS = new Set(['source_description']);

const COLUMN = /^[a-z_][a-z0-9_]*$/i;

const NO_FOLIO_ROW =
  'No existing folio_annotations rows were found for this work, so source_description was not updated.';

type Row = Record<string, unknown>;

const empty = (): WorkMetadataChanges => ({
  group: 'work-metadata',
  work: null,
  titles: [],
  folioAnnotation: null,
});

type Write = {
  /** What the write changes, for an error message. */
  what: string;
  run: () => PromiseLike<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
  /** Rows the write must return, when it asks for them back. */
  rows?: number;
};

/**
 * Runs the writes in order and stops at the first that fails. A write that
 * returns fewer rows than it should was refused, as row-level security does
 * silently for an update. The group is not atomic: once one write has
 * landed, a later failure leaves the outcome `'unknown'`.
 */
const commitWrites = async (writes: Write[]): Promise<GroupCommit> => {
  let done = 0;
  for (const write of writes) {
    const failed = (message: string, nothingWritten: boolean): GroupCommit => ({
      applied: done === 0 && nothingWritten ? false : 'unknown',
      warnings: [],
      error:
        done === 0
          ? nothingWritten
            ? `Nothing was saved: ${write.what} failed: ${message}`
            : `The save may have been applied: ${write.what} failed: ${message}`
          : `Partly saved: ${done} of ${writes.length} work metadata writes were saved before ${write.what} failed: ${message}`,
    });
    let result: Awaited<ReturnType<Write['run']>>;
    try {
      result = await write.run();
    } catch (thrown) {
      return failed(
        thrown instanceof Error ? thrown.message : String(thrown),
        false,
      );
    }
    if (result.error) {
      return failed(result.error.message, rolledBack(result.error.code));
    }
    const returned = Array.isArray(result.data) ? result.data.length : 0;
    if (write.rows !== undefined && returned < write.rows) {
      return failed(
        returned === 0
          ? 'no row was updated; it is missing, or this account may not change it'
          : `${returned} of ${write.rows} rows were updated`,
        returned === 0,
      );
    }
    done += 1;
  }
  return { applied: true, warnings: [] };
};

const badColumn = (fields: string[]) =>
  fields.find((field) => !COLUMN.test(field));

/**
 * Plans the work-metadata group: the work row, its titles and its folio
 * annotation, read and checked against each op's `expect`. Commits with
 * direct table writes in that order.
 */
export const planWorkMetadata = async ({
  client,
  workUuid,
  ops,
}: {
  client: DataClient;
  workUuid: string;
  ops: WorkMetadataOp[];
}): Promise<GroupPlan<WorkMetadataChanges>> => {
  const changes = empty();
  const warnings: WorkEditWarning[] = [];
  const fail = (error: string): GroupPlan<WorkMetadataChanges> => ({
    ok: false,
    changes,
    warnings,
    error,
  });
  const writes: Write[] = [];

  // The work row.
  const workOps = ops.filter((op) => op.op === 'update-work');
  const workPatch: Row = Object.assign({}, ...workOps.map((op) => op.patch));
  const workFields = [
    ...new Set([
      ...Object.keys(workPatch),
      ...workOps.flatMap((op) => Object.keys(op.expect ?? {})),
    ]),
  ];
  if (workFields.length > 0) {
    const bad = badColumn(workFields);
    if (bad) return fail(`update-work: ${JSON.stringify(bad)} is not a field`);
    const { data, error } = await client
      .from('works')
      .select(workFields.join(','))
      .eq('uuid', workUuid);
    if (error) {
      return fail(
        `Nothing was saved: failed to read the work: ${error.message}`,
      );
    }
    const stored = ((data ?? []) as unknown as Row[])[0];
    if (!stored) return fail(`Nothing was saved: no work ${workUuid}`);
    for (const op of workOps) {
      const mismatch = expectMismatch('update-work', stored, op.expect);
      if (mismatch) return fail(mismatch);
    }
    if (Object.keys(workPatch).length > 0) {
      changes.work = {
        fields: Object.fromEntries(
          Object.entries(workPatch).map(([field, to]) => [
            field,
            { from: stored[field] ?? null, to },
          ]),
        ),
      };
      writes.push({
        what: 'the work update',
        run: () =>
          client
            .from('works')
            .update(workPatch)
            .eq('uuid', workUuid)
            .select('uuid'),
        rows: 1,
      });
    }
  }

  // Titles, by slot.
  const titleOps = ops.filter((op) => op.op === 'upsert-title');
  if (titleOps.length > 0) {
    const { data, error } = await client
      .from('titles')
      .select('uuid, type, language, content')
      .eq('work_uuid', workUuid);
    if (error) {
      return fail(`Nothing was saved: failed to read titles: ${error.message}`);
    }
    const slots = new Map<string, Row>();
    for (const row of (data ?? []) as Row[]) {
      slots.set(
        titleSlotKey({
          type: row.type as string,
          language: row.language as string | null,
          content: row.content as string,
        }),
        row,
      );
    }
    const planned = new Map<string, WorkMetadataChanges['titles'][number]>();
    for (const op of titleOps) {
      const slot = titleSlotKey(op.title);
      const stored = slots.get(slot);
      const mismatch = expectMismatch(
        `upsert-title ${slot}`,
        stored,
        op.expect,
      );
      if (mismatch) return fail(mismatch);
      // A slot sent twice keeps the last content.
      planned.set(
        slot,
        stored
          ? {
              action: 'update',
              uuid: stored.uuid as string,
              type: op.title.type,
              language: op.title.language ?? null,
              content: op.title.content,
              previous: stored.content as string,
            }
          : {
              action: 'insert',
              uuid: planned.get(slot)?.uuid ?? op.title.uuid ?? uuidv4(),
              type: op.title.type,
              language: op.title.language ?? null,
              content: op.title.content,
            },
      );
    }
    changes.titles = [...planned.values()];
    const inserts = changes.titles.filter((title) => title.action === 'insert');
    if (inserts.length > 0) {
      writes.push({
        what: 'the title insert',
        run: () =>
          client.from('titles').insert(
            inserts.map((title) => ({
              uuid: title.uuid,
              work_uuid: workUuid,
              content: title.content,
              type: title.type,
              language: title.language,
            })),
          ),
      });
    }
    for (const title of changes.titles) {
      if (title.action !== 'update') continue;
      writes.push({
        what: `the ${title.type} title update`,
        run: () =>
          client
            .from('titles')
            .update({ content: title.content })
            .eq('uuid', title.uuid)
            .select('uuid'),
        rows: 1,
      });
    }
  }

  // The folio annotation rows of the work.
  const folioOps = ops.filter((op) => op.op === 'upsert-folio-annotation');
  if (folioOps.length > 0) {
    const sent: Row = Object.assign({}, ...folioOps.map((op) => op.patch));
    const ignored = Object.keys(sent).filter((key) => !FOLIO_FIELDS.has(key));
    if (ignored.length > 0) {
      warnings.push({
        message: `upsert-folio-annotation: only source_description is written; ignored ${ignored.join(', ')}.`,
      });
    }
    const folioPatch: Row = Object.fromEntries(
      Object.entries(sent).filter(([key]) => FOLIO_FIELDS.has(key)),
    );
    if (typeof folioPatch.source_description !== 'string') {
      return fail(
        'upsert-folio-annotation: source_description must be a string',
      );
    }
    const expectFields = folioOps.flatMap((op) => Object.keys(op.expect ?? {}));
    const bad = badColumn(expectFields);
    if (bad) {
      return fail(
        `upsert-folio-annotation: ${JSON.stringify(bad)} is not a field`,
      );
    }
    const { data, error } = await client
      .from('folio_annotations')
      .select(['uuid', ...new Set(expectFields)].join(','))
      .eq('work_uuid', workUuid)
      .eq('annotation_type', 'work');
    if (error) {
      return fail(
        `Nothing was saved: failed to read folio annotations: ${error.message}`,
      );
    }
    const rows = (data ?? []) as unknown as Row[];
    for (const op of folioOps) {
      for (const row of rows) {
        const mismatch = expectMismatch(
          'upsert-folio-annotation',
          row,
          op.expect,
        );
        if (mismatch) return fail(mismatch);
      }
    }
    changes.folioAnnotation = { rows: rows.length, fields: folioPatch };
    if (rows.length === 0) {
      warnings.push({ message: NO_FOLIO_ROW });
    } else {
      writes.push({
        what: 'the folio annotation update',
        run: () =>
          client
            .from('folio_annotations')
            .update(folioPatch)
            .eq('work_uuid', workUuid)
            .eq('annotation_type', 'work')
            .select('uuid'),
        rows: rows.length,
      });
    }
  }

  return {
    ok: true,
    changes,
    warnings,
    extra: undefined,
    commit: () => commitWrites(writes),
  };
};
