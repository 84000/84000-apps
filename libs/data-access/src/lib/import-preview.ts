import { v4 as uuidv4 } from 'uuid';
import { savePassagesWithDeletions } from './passage';
import { importPassageUuid, occurrenceCounter } from './passage/derived-uuids';
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
 * `derived` says whether the row's uuid is the one this scheme derives for
 * it; a row without one was saved by an import that minted random uuids.
 * Throws when the read fails.
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

  // A repeated xmlId was saved under its 2nd, 3rd... derived uuid.
  const repeats = new Map<string, number>();
  stored.forEach(({ xmlId }) =>
    repeats.set(xmlId, (repeats.get(xmlId) ?? 0) + 1),
  );
  const isDerived = ({ uuid, xmlId }: { uuid: string; xmlId: string }) =>
    Array.from({ length: repeats.get(xmlId) ?? 1 }, (_, at) =>
      importPassageUuid(workUuid, xmlId, at + 1),
    ).includes(uuid);

  return stored
    .filter((row) => !saved.has(row.uuid))
    .map((row) => ({ ...row, derived: isDerived(row) }));
};

/**
 * The stored passages a derived uuid would overwrite at another position:
 * one an earlier import saved and an edit has since moved, so the incoming
 * passage is not it. Throws when the read fails.
 */
export const findMovedImportPassages = async ({
  client,
  passages,
}: {
  client: DataClient;
  passages: { uuid: string; sort: number; xmlId: string }[];
}): Promise<{ xmlId: string; sort: number; storedSort: number }[]> => {
  const incoming = new Map(passages.map((passage) => [passage.uuid, passage]));
  const moved: { xmlId: string; sort: number; storedSort: number }[] = [];
  for (const batch of inBatches([...incoming.keys()])) {
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
      const passage = incoming.get(row.uuid);
      if (passage && passage.sort !== row.sort) {
        moved.push({
          xmlId: passage.xmlId,
          sort: passage.sort,
          storedSort: row.sort,
        });
      }
    }
  }
  return moved;
};

/**
 * Saves an import's passages. A large import is committed in chunks, so it is
 * not all-or-nothing: a failure partway leaves the chunks before it saved, and
 * the error says how many passages were. Re-running the same import converges:
 * passages and annotations sent without uuids get derived ones, so the rows
 * already saved are matched and updated rather than saved again.
 */
export const upsertPassagesFromPreview = async ({
  client,
  preview,
}: {
  client: DataClient;
  preview: ImportPreview;
}) => {
  const passages = preview.operations
    .filter(
      (operation): operation is PassageInsertOperation =>
        operation.kind === 'upsert_passage',
    )
    .map(previewDtoToPassage);

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
  const occurrence = occurrenceCounter();

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
      const nth = occurrence(JSON.stringify([passageWorkUuid, xmlId]));

      return {
        kind: 'upsert_passage',
        passage: {
          uuid:
            operation.passage.uuid ??
            importPassageUuid(passageWorkUuid, xmlId, nth),
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
      `Nothing was saved: ${moved.length} passage(s) would overwrite a stored passage an earlier import saved and an edit has since moved: ${sample}. Send the uuid of each passage you mean to rewrite.`,
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
