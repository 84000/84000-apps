import {
  v4 as uuidv4,
  validate as isUuid,
  version as uuidVersion,
} from 'uuid';
import { savePassagesWithDeletions } from './passage';
import {
  derivedUuidAllocator,
  importPassageUuid,
} from './passage/derived-uuids';
import { inBatches } from './passage/in-batches';
import {
  DataClient,
  ImportOperation,
  ImportOperationInput,
  ImportPreview,
  PassageInsertOperation,
  previewDtoToPassage,
} from './types';

/**
 * Identity for a title "slot". The document is authoritative for titles, so
 * import upserts by slot: a title whose slot already exists is updated to the
 * document's content, and one whose slot is new is inserted.
 *
 * Titles with a language occupy a fixed (type, language) slot — e.g. the
 * English main title. Titles without a language (additional / other titles have
 * no slot) fall back to (type, content) so distinct ones coexist and an exact
 * duplicate resolves to a harmless no-op update.
 */
export const titleSlotKey = (title: {
  type: string;
  language?: string | null;
  content: string;
}): string =>
  title.language
    ? `${title.type}|${title.language}`
    : `${title.type}|${title.content}`;

/**
 * Maps each existing title slot on the work to its row UUID, so import can
 * update the right row when a slot is already filled.
 */
export const getExistingTitleSlots = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<Map<string, string>> => {
  const { data, error } = await client
    .from('titles')
    .select('uuid, type, language, content')
    .eq('work_uuid', workUuid);

  if (error) {
    throw error;
  }

  const slots = new Map<string, string>();
  for (const row of data ?? []) {
    slots.set(
      titleSlotKey({
        type: row.type as string,
        language: row.language as string | null,
        content: row.content as string,
      }),
      row.uuid as string,
    );
  }
  return slots;
};

export const updateWorkFromPreview = async ({
  client,
  workUuid,
  preview,
}: {
  client: DataClient;
  workUuid: string;
  preview: ImportPreview;
}) => {
  const patch = preview.operations.reduce<Record<string, unknown>>(
    (acc, operation) => {
      if (operation.kind === 'update_work') {
        Object.assign(acc, operation.patch);
      }
      return acc;
    },
    {},
  );

  if (Object.keys(patch).length === 0) {
    return false;
  }

  const { error } = await client
    .from('works')
    .update(patch)
    .eq('uuid', workUuid);

  if (error) {
    throw error;
  }

  return true;
};

export const upsertTitlesFromPreview = async ({
  client,
  preview,
  existingSlots,
}: {
  client: DataClient;
  preview: ImportPreview;
  /** Existing title slots (slot key → row UUID); matching titles are updated. */
  existingSlots?: Map<string, string>;
}): Promise<{ inserted: number; updated: number }> => {
  const titleOps = preview.operations.filter(
    (operation) => operation.kind === 'upsert_title',
  );

  const slots = existingSlots ?? new Map<string, string>();
  const toInsert: {
    uuid: string;
    work_uuid: string;
    content: string;
    type: string;
    language: string | null;
  }[] = [];
  const toUpdate: { uuid: string; content: string }[] = [];

  for (const operation of titleOps) {
    const existingUuid = slots.get(titleSlotKey(operation.title));
    if (existingUuid) {
      toUpdate.push({ uuid: existingUuid, content: operation.title.content });
    } else {
      toInsert.push({
        uuid: operation.title.uuid,
        work_uuid: operation.title.workUuid,
        content: operation.title.content,
        type: operation.title.type,
        language: operation.title.language ?? null,
      });
    }
  }

  if (toInsert.length > 0) {
    const { error } = await client.from('titles').insert(toInsert);
    if (error) {
      throw error;
    }
  }

  for (const update of toUpdate) {
    const { error } = await client
      .from('titles')
      .update({ content: update.content })
      .eq('uuid', update.uuid);
    if (error) {
      throw error;
    }
  }

  return { inserted: toInsert.length, updated: toUpdate.length };
};

export const updateFolioAnnotationsFromPreview = async ({
  client,
  workUuid,
  preview,
}: {
  client: DataClient;
  workUuid: string;
  preview: ImportPreview;
}) => {
  const sourceDescription = preview.operations.find(
    (operation) =>
      operation.kind === 'update_folio_annotation' &&
      typeof operation.patch.source_description === 'string',
  );

  if (
    !sourceDescription ||
    sourceDescription.kind !== 'update_folio_annotation'
  ) {
    return {
      updated: 0,
      warning: null,
    };
  }

  const { data: existingRows, error: selectError } = await client
    .from('folio_annotations')
    .select('uuid')
    .eq('work_uuid', workUuid)
    .eq('annotation_type', 'work');

  if (selectError) {
    throw selectError;
  }

  if (!existingRows || existingRows.length === 0) {
    return {
      updated: 0,
      warning:
        'No existing folio_annotations rows were found for this work, so source_description was not updated.',
    };
  }

  const { error: updateError } = await client
    .from('folio_annotations')
    .update({
      source_description: sourceDescription.patch.source_description,
    })
    .eq('work_uuid', workUuid)
    .eq('annotation_type', 'work');

  if (updateError) {
    throw updateError;
  }

  return {
    updated: existingRows.length,
    warning: null,
  };
};

const IMPORT_XML_ID_PREFIX = 'docx-';
const PAGE_SIZE = 1000;

/**
 * Passages an earlier import saved to the work that are not among `saved`.
 * `derived` says whether the row's uuid was derived (a UUIDv5); a row without
 * one was saved by an import that minted random uuids. The version, not a
 * recomputed uuid, is what counts: a passage saved as the 2nd of a repeated
 * xmlId stays derived after the 1st is deleted. Throws when the read fails.
 */
export const findLeftoverImportPassages = async ({
  client,
  workUuid,
  saved,
}: {
  client: DataClient;
  workUuid: string;
  saved: Set<string>;
}): Promise<{ uuid: string; xmlId: string; derived: boolean }[]> => {
  const stored: { uuid: string; xmlId: string }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('passages')
      .select('uuid, xmlId')
      .eq('work_uuid', workUuid)
      .like('xmlId', `${IMPORT_XML_ID_PREFIX}%`)
      .order('sort')
      .order('uuid')
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(
        `Nothing was saved: failed to read earlier import passages: ${error.message}`,
      );
    }
    const rows = (data ?? []) as { uuid: string; xmlId: string }[];
    stored.push(...rows);
    if (rows.length < PAGE_SIZE) {
      break;
    }
  }

  return stored
    .filter((row) => !saved.has(row.uuid))
    .map((row) => ({
      ...row,
      derived: isUuid(row.uuid) && uuidVersion(row.uuid) === 5,
    }));
};

/**
 * The indexes of a longest non-decreasing run within `values`, which need not
 * be contiguous.
 */
const longestOrderedRun = (values: number[]): Set<number> => {
  const tails: number[] = [];
  const previous = values.map(() => -1);
  values.forEach((value, at) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (values[tails[mid]] <= value) low = mid + 1;
      else high = mid;
    }
    previous[at] = low > 0 ? tails[low - 1] : -1;
    tails[low] = at;
  });
  const run = new Set<number>();
  for (let at = tails[tails.length - 1] ?? -1; at >= 0; at = previous[at]) {
    run.add(at);
  }
  return run;
};

/**
 * The stored passages a derived uuid would overwrite out of order: ones an
 * earlier import saved that an edit has since moved past others of this
 * import, so the incoming passage is not the one there. The order is what is
 * compared, not the sort: a save shifts stored sorts to make room for a new
 * passage, and an earlier run of this import, or an insert, does that without
 * moving anything. Passages that share an intended sort may be stored in
 * either order. One passage alone is never reported. Throws when the read
 * fails.
 */
export const findMovedImportPassages = async ({
  client,
  passages,
}: {
  client: DataClient;
  passages: { uuid: string; sort: number; xmlId: string }[];
}): Promise<{ xmlId: string; sort: number; storedSort: number }[]> => {
  const storedSorts = new Map<string, number>();
  for (const batch of inBatches(passages.map(({ uuid }) => uuid))) {
    const { data, error } = await client
      .from('passages')
      .select('uuid, sort')
      .in('uuid', batch);
    if (error) {
      throw new Error(
        `Nothing was saved: failed to read stored passages: ${error.message}`,
      );
    }
    for (const row of (data ?? []) as { uuid: string; sort: number }[]) {
      storedSorts.set(row.uuid, row.sort);
    }
  }

  const matched = passages
    .flatMap(({ uuid, sort, xmlId }) => {
      const storedSort = storedSorts.get(uuid);
      return storedSort === undefined ? [] : [{ xmlId, sort, storedSort }];
    })
    .sort((a, b) => a.sort - b.sort || a.storedSort - b.storedSort);
  const inOrder = longestOrderedRun(matched.map((row) => row.storedSort));
  return matched.filter((_, at) => !inOrder.has(at));
};

/**
 * Annotation uuids, of those given with their passage, that are stored on a
 * different passage. Throws when the read fails.
 */
const findAnnotationsElsewhere = async ({
  client,
  rows,
}: {
  client: DataClient;
  rows: Map<string, string>;
}): Promise<Set<string>> => {
  const elsewhere = new Set<string>();
  for (const batch of inBatches([...rows.keys()])) {
    const { data, error } = await client
      .from('passage_annotations')
      .select('uuid, passage_uuid')
      .in('uuid', batch);
    if (error) {
      throw new Error(
        `No passages were saved: failed to read stored annotations: ${error.message}`,
      );
    }
    for (const row of (data ?? []) as {
      uuid: string;
      passage_uuid: string;
    }[]) {
      if (row.passage_uuid !== rows.get(row.uuid)) {
        elsewhere.add(row.uuid);
      }
    }
  }
  return elsewhere;
};

/**
 * Saves an import's passages. A large import is committed in chunks, so it is
 * not all-or-nothing: a failure partway leaves the chunks before it saved, and
 * the error says how many passages were. Re-running the same import converges:
 * passages and annotations sent without uuids get derived ones, so the rows
 * already saved are matched and updated rather than saved again. A derived
 * annotation uuid stored on another passage, where an edit moved the row, is
 * replaced by a random one, so the row stays where the edit put it.
 */
export const upsertPassagesFromPreview = async ({
  client,
  preview,
}: {
  client: DataClient;
  preview: ImportPreview;
}) => {
  const operations = preview.operations.filter(
    (operation): operation is PassageInsertOperation =>
      operation.kind === 'upsert_passage',
  );
  const derived = new Map<string, string>();
  operations.forEach((operation) => {
    const sent = new Set(operation.annotations.map((input) => input.uuid));
    previewDtoToPassage(operation).annotations.forEach((annotation) => {
      if (!sent.has(annotation.uuid)) {
        derived.set(annotation.uuid, operation.passage.uuid);
      }
    });
  });
  const elsewhere = await findAnnotationsElsewhere({ client, rows: derived });
  const passages = operations.map((operation) =>
    previewDtoToPassage(operation, elsewhere),
  );
  const warnings =
    elsewhere.size > 0
      ? [
          `${elsewhere.size} annotation(s) matched rows an edit has moved to another passage, so they were saved under new uuids and the moved rows were left in place.`,
        ]
      : [];

  const result = await savePassagesWithDeletions({
    client,
    passages,
    chunked: true,
  });

  if (!result.success) {
    throw new Error(result.error ?? 'Failed to save imported passages.');
  }

  return {
    passages: passages.length,
    annotations: passages.reduce(
      (count, passage) => count + passage.annotations.length,
      0,
    ),
    warnings,
  };
};

/**
 * Fills in the deterministic fields an agent should not have to supply: title
 * and passage UUIDs (a passage's derived from its work and xmlId), the
 * owning work reference, monotonic passage sort order, and derived xmlIds. `update_work` and `update_folio_annotation` operations
 * pass through unchanged.
 */
export const normalizeImportOperations = (
  workUuid: string,
  operations: ImportOperationInput[],
): ImportOperation[] => {
  let nextSort = 0;
  const allocate = derivedUuidAllocator(
    operations.flatMap((operation) =>
      operation.kind === 'upsert_passage' && operation.passage.uuid
        ? [operation.passage.uuid]
        : [],
    ),
  );

  return operations.map((operation) => {
    if (operation.kind === 'upsert_title') {
      return {
        kind: 'upsert_title',
        title: {
          uuid: operation.title.uuid ?? uuidv4(),
          workUuid: operation.title.workUuid ?? workUuid,
          content: operation.title.content,
          language: operation.title.language,
          type: operation.title.type,
        },
      };
    }

    if (operation.kind === 'upsert_passage') {
      const sort = operation.passage.sort ?? nextSort;
      nextSort = sort + 1;
      const passageWorkUuid = operation.passage.workUuid ?? workUuid;
      const xmlId = operation.passage.xmlId ?? `docx-${sort}`;

      return {
        kind: 'upsert_passage',
        passage: {
          uuid:
            operation.passage.uuid ??
            allocate(JSON.stringify([passageWorkUuid, xmlId]), (nth) =>
              importPassageUuid(passageWorkUuid, xmlId, nth),
            ),
          workUuid: passageWorkUuid,
          label: operation.passage.label,
          sort,
          type: operation.passage.type,
          content: operation.passage.content,
          xmlId,
        },
        annotations: operation.annotations ?? [],
      };
    }

    return operation;
  });
};

/**
 * Summarizes an operation set into the counts surfaced in an import preview.
 */
export const summarizeImportOperations = (
  operations: ImportOperation[],
): ImportPreview['counts'] => {
  return operations.reduce<ImportPreview['counts']>(
    (counts, operation) => {
      if (operation.kind === 'upsert_title') {
        counts.titles += 1;
      } else if (operation.kind === 'upsert_passage') {
        counts.passages += 1;
        counts.annotations += operation.annotations.length;
      } else if (operation.kind === 'update_work') {
        counts.workUpdates += 1;
      } else if (operation.kind === 'update_folio_annotation') {
        counts.folioUpdates += 1;
      }
      return counts;
    },
    { titles: 0, passages: 0, annotations: 0, workUpdates: 0, folioUpdates: 0 },
  );
};

/**
 * Applies a set of import or update operations to a target work in one pass:
 * work metadata, titles, folio source description, and passages (with their
 * annotations) via the shared passage save path.
 */
export const applyImportPreview = async ({
  client,
  workUuid,
  operations,
}: {
  client: DataClient;
  workUuid: string;
  operations: ImportOperationInput[];
}) => {
  const normalized = normalizeImportOperations(workUuid, operations);
  const preview: ImportPreview = {
    operations: normalized,
    counts: summarizeImportOperations(normalized),
  };

  const warnings: string[] = [];

  // Passages whose uuid this call derived rather than received.
  const derived = normalized.flatMap((operation, at) => {
    const input = operations[at];
    return operation.kind === 'upsert_passage' &&
      input.kind === 'upsert_passage' &&
      !input.passage.uuid
      ? [operation.passage]
      : [];
  });

  const moved = await findMovedImportPassages({
    client,
    passages: derived.map(({ uuid, sort, xmlId }) => ({
      uuid,
      sort,
      xmlId: xmlId ?? '',
    })),
  });
  if (moved.length > 0) {
    const sample = moved
      .slice(0, 10)
      .map(
        (row) => `${row.xmlId} (sort ${row.sort}, stored at ${row.storedSort})`,
      )
      .join(', ');
    throw new Error(
      `Nothing was saved: ${moved.length} passage(s) would overwrite a stored passage an earlier import saved and an edit has since moved out of this import's order: ${sample}. Send the uuid of each passage you mean to rewrite.`,
    );
  }

  const saved = new Set(
    normalized.flatMap((operation) =>
      operation.kind === 'upsert_passage' ? [operation.passage.uuid] : [],
    ),
  );
  const leftover =
    derived.length > 0
      ? await findLeftoverImportPassages({ client, workUuid, saved })
      : [];
  const xmlIds = (rows: { xmlId: string }[]) =>
    rows
      .slice(0, 10)
      .map((row) => row.xmlId)
      .join(', ') + (rows.length > 10 ? ', …' : '');
  const unmatched = leftover.filter((row) => !row.derived);
  if (unmatched.length > 0) {
    throw new Error(
      `Nothing was saved: ${unmatched.length} passage(s) an earlier import saved under uuids this import cannot match (${xmlIds(unmatched)}), so it would add a second copy of them. Send the stored uuid of each passage you mean to rewrite, and a new uuid for each passage you add.`,
    );
  }
  const shorter = leftover.filter((row) => row.derived);
  if (shorter.length > 0) {
    warnings.push(
      `${shorter.length} passage(s) saved by an earlier import are not in this one and were left in place (${xmlIds(shorter)}).`,
    );
  }

  const workUpdated = await updateWorkFromPreview({
    client,
    workUuid,
    preview,
  });

  // The document is authoritative for titles. Upsert by slot: update the title
  // already occupying a slot to the document's content, insert new slots.
  const existingTitleSlots = await getExistingTitleSlots({ client, workUuid });
  const titleResult = await upsertTitlesFromPreview({
    client,
    preview,
    existingSlots: existingTitleSlots,
  });

  const folioResult = await updateFolioAnnotationsFromPreview({
    client,
    workUuid,
    preview,
  });
  if (folioResult.warning) {
    warnings.push(folioResult.warning);
  }

  const passageResult = await upsertPassagesFromPreview({ client, preview });
  warnings.push(...passageResult.warnings);

  return {
    counts: {
      workUpdates: workUpdated ? 1 : 0,
      titles: titleResult.inserted,
      titlesUpdated: titleResult.updated,
      folioUpdates: folioResult.updated,
      passages: passageResult.passages,
      annotations: passageResult.annotations,
    },
    warnings,
  };
};
