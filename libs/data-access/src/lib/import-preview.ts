import { v4 as uuidv4 } from 'uuid';
import { savePassagesWithDeletions } from './passage';
import {
  DataClient,
  ImportOperation,
  ImportOperationInput,
  ImportPreview,
  PassageInsertOperation,
  previewDtoToPassage,
} from './types';

/**
 * Guards the docx-import contract: the target work must have no passages yet.
 * Titles are handled separately — it is common for a work's titles to be
 * created before its content, so their presence is not an error.
 */
export const assertImportTargetHasNoPassages = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}) => {
  const { count, error } = await client
    .from('passages')
    .select('uuid', { count: 'exact', head: true })
    .eq('work_uuid', workUuid);

  if (error) {
    throw error;
  }

  if ((count || 0) > 0) {
    throw new Error(
      `Work ${workUuid} already contains passages. Import currently requires a work with no passages.`,
    );
  }
};

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
    (operation) => operation.kind === 'insert_title',
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
      operation.kind === 'upsert_folio_annotation' &&
      typeof operation.patch.source_description === 'string',
  );

  if (
    !sourceDescription ||
    sourceDescription.kind !== 'upsert_folio_annotation'
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

export const insertPassagesFromPreview = async ({
  client,
  preview,
}: {
  client: DataClient;
  preview: ImportPreview;
}) => {
  const passages = preview.operations
    .filter(
      (operation): operation is PassageInsertOperation =>
        operation.kind === 'insert_passage',
    )
    .map(previewDtoToPassage);

  const result = await savePassagesWithDeletions({
    client,
    passages,
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
 * and passage UUIDs, the owning work reference, monotonic passage sort order,
 * and derived xmlIds. `update_work` and `upsert_folio_annotation` operations
 * pass through unchanged.
 */
export const normalizeImportOperations = (
  workUuid: string,
  operations: ImportOperationInput[],
): ImportOperation[] => {
  let nextSort = 0;

  return operations.map((operation) => {
    if (operation.kind === 'insert_title') {
      return {
        kind: 'insert_title',
        title: {
          uuid: operation.title.uuid ?? uuidv4(),
          workUuid: operation.title.workUuid ?? workUuid,
          content: operation.title.content,
          language: operation.title.language,
          type: operation.title.type,
        },
      };
    }

    if (operation.kind === 'insert_passage') {
      const sort = operation.passage.sort ?? nextSort;
      nextSort = sort + 1;

      return {
        kind: 'insert_passage',
        passage: {
          uuid: operation.passage.uuid ?? uuidv4(),
          workUuid: operation.passage.workUuid ?? workUuid,
          label: operation.passage.label,
          sort,
          type: operation.passage.type,
          content: operation.passage.content,
          xmlId: operation.passage.xmlId ?? `docx-${sort}`,
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
      if (operation.kind === 'insert_title') {
        counts.titles += 1;
      } else if (operation.kind === 'insert_passage') {
        counts.passages += 1;
        counts.annotations += operation.annotations.length;
      } else if (operation.kind === 'update_work') {
        counts.workUpdates += 1;
      } else if (operation.kind === 'upsert_folio_annotation') {
        counts.folioUpdates += 1;
      }
      return counts;
    },
    { titles: 0, passages: 0, annotations: 0, workUpdates: 0, folioUpdates: 0 },
  );
};

/**
 * Applies a set of import operations to an empty target work in one pass:
 * work metadata, titles, folio source description, and passages (with their
 * annotations) via the shared passage save path. This is the single entry point
 * used by the docx-import MCP write tool.
 *
 * The target work must have no passages (`assertImportTargetHasNoPassages`
 * throws otherwise). Existing titles are left untouched and title import is
 * skipped when any are present.
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
  await assertImportTargetHasNoPassages({ client, workUuid });

  const normalized = normalizeImportOperations(workUuid, operations);
  const preview: ImportPreview = {
    operations: normalized,
    counts: summarizeImportOperations(normalized),
  };

  const warnings: string[] = [];

  const workUpdated = await updateWorkFromPreview({ client, workUuid, preview });

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

  const passageResult = await insertPassagesFromPreview({ client, preview });

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
