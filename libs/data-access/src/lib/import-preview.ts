import { savePassagesWithDeletions } from './passage';
import {
  DataClient,
  ImportPreview,
  PassageInsertOperation,
  previewDtoToPassage,
} from './types';

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

export const insertTitlesFromPreview = async ({
  client,
  preview,
}: {
  client: DataClient;
  preview: ImportPreview;
}) => {
  const titles = preview.operations
    .filter((operation) => operation.kind === 'insert_title')
    .map((operation) => ({
      uuid: operation.title.uuid,
      work_uuid: operation.title.workUuid,
      content: operation.title.content,
      type: operation.title.type,
      language: operation.title.language ?? null,
    }));

  if (titles.length === 0) {
    return 0;
  }

  const { error } = await client.from('titles').insert(titles);

  if (error) {
    throw error;
  }

  return titles.length;
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
