import {
  type Annotation,
  type BodyItemType,
  type DataClient,
  type Passage,
  savePassagesWithDeletions,
  storageBucketExists,
} from '@eightyfourthousand/data-access';

import type {
  ImportPreview,
  PassageInsertOperation,
  PreviewAnnotationOperation,
} from './types';

const HEADING_CLASS_FALLBACK = 'section-title';

function normalizePassageType(type: string): BodyItemType {
  if (type === 'preface') {
    return 'prelude';
  }

  if (type === 'prefaceHeader') {
    return 'preludeHeader';
  }

  if (type === 'acknowledgement') {
    return 'acknowledgment';
  }

  if (type === 'acknowledgementHeader') {
    return 'acknowledgmentHeader';
  }

  return type as BodyItemType;
}

function previewAnnotationToAnnotation({
  annotation,
  passageUuid,
  passageText,
}: {
  annotation: PreviewAnnotationOperation;
  passageUuid: string;
  passageText: string;
}): Annotation | null {
  const base = {
    uuid: `${passageUuid}:${annotation.kind}:${annotation.start}:${annotation.end}`,
    start: annotation.start,
    end: annotation.end,
    passageUuid,
  };

  if (annotation.kind === 'blockquote') {
    return { ...base, type: 'blockquote' };
  }

  if (annotation.kind === 'paragraph') {
    return { ...base, type: 'paragraph' };
  }

  if (annotation.kind === 'indent') {
    return { ...base, type: 'indent' };
  }

  if (annotation.kind === 'line-group') {
    return { ...base, type: 'lineGroup' };
  }

  if (annotation.kind === 'line') {
    return { ...base, type: 'line' };
  }

  if (annotation.kind === 'span') {
    return {
      ...base,
      type: 'span',
      textStyle:
        typeof annotation.data?.textStyle === 'string'
          ? annotation.data.textStyle
          : undefined,
    };
  }

  if (annotation.kind === 'link') {
    const href =
      typeof annotation.data?.href === 'string' ? annotation.data.href : undefined;

    if (!href) {
      return null;
    }

    return {
      ...base,
      type: 'link',
      href,
      text: passageText.slice(annotation.start, annotation.end),
    };
  }

  if (annotation.kind === 'heading') {
    const level =
      typeof annotation.data?.level === 'number' ? annotation.data.level : 1;
    const headingClass =
      typeof annotation.data?.class === 'string'
        ? annotation.data.class
        : HEADING_CLASS_FALLBACK;

    return {
      ...base,
      type: 'heading',
      level,
      class: headingClass as never,
    };
  }

  return null;
}

function previewPassageToPassage(
  operation: PassageInsertOperation,
): Passage {
  return {
    uuid: operation.passage.uuid,
    workUuid: operation.passage.workUuid,
    label: operation.passage.label,
    sort: operation.passage.sort,
    type: normalizePassageType(operation.passage.type),
    content: operation.passage.content,
    xmlId: operation.passage.xmlId,
    annotations: operation.annotations
      .map((annotation) =>
        previewAnnotationToAnnotation({
          annotation,
          passageUuid: operation.passage.uuid,
          passageText: operation.passage.content,
        }),
      )
      .filter((annotation): annotation is Annotation => annotation !== null),
  };
}

async function assertImportTargetIsEmpty({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}) {
  const [{ count: titleCount, error: titleError }, { count: passageCount, error: passageError }] =
    await Promise.all([
      client
        .from('titles')
        .select('uuid', { count: 'exact', head: true })
        .eq('work_uuid', workUuid),
      client
        .from('passages')
        .select('uuid', { count: 'exact', head: true })
        .eq('work_uuid', workUuid),
    ]);

  if (titleError) {
    throw titleError;
  }

  if (passageError) {
    throw passageError;
  }

  if ((titleCount || 0) > 0 || (passageCount || 0) > 0) {
    throw new Error(
      `Work ${workUuid} already contains titles or passages. Import currently requires an empty target work.`,
    );
  }
}

async function updateWorkFromPreview({
  client,
  workUuid,
  preview,
}: {
  client: DataClient;
  workUuid: string;
  preview: ImportPreview;
}) {
  const patch = preview.operations.reduce<Record<string, unknown>>((acc, operation) => {
    if (operation.kind === 'update_work') {
      Object.assign(acc, operation.patch);
    }
    return acc;
  }, {});

  if (Object.keys(patch).length === 0) {
    return false;
  }

  const { error } = await client.from('works').update(patch).eq('uuid', workUuid);

  if (error) {
    throw error;
  }

  return true;
}

async function insertTitlesFromPreview({
  client,
  preview,
}: {
  client: DataClient;
  preview: ImportPreview;
}) {
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
}

async function updateFolioAnnotationsFromPreview({
  client,
  workUuid,
  preview,
}: {
  client: DataClient;
  workUuid: string;
  preview: ImportPreview;
}) {
  const sourceDescription = preview.operations.find(
    (operation) =>
      operation.kind === 'upsert_folio_annotation' &&
      typeof operation.patch.source_description === 'string',
  );

  if (!sourceDescription || sourceDescription.kind !== 'upsert_folio_annotation') {
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
}

async function insertPassagesFromPreview({
  client,
  preview,
}: {
  client: DataClient;
  preview: ImportPreview;
}) {
  const passages = preview.operations
    .filter((operation): operation is PassageInsertOperation => operation.kind === 'insert_passage')
    .map(previewPassageToPassage);

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
}

export async function assertDocxImportBucketReady({
  client,
  bucket,
}: {
  client: DataClient;
  bucket: string;
}) {
  const exists = await storageBucketExists({
    client,
    bucket,
  });

  if (!exists) {
    throw new Error(
      `Storage bucket "${bucket}" was not found. Create it in the Supabase console before using the DOCX import flow.`,
    );
  }
}

export async function persistImportPreview({
  client,
  workUuid,
  preview,
}: {
  client: DataClient;
  workUuid: string;
  preview: ImportPreview;
}) {
  await assertImportTargetIsEmpty({
    client,
    workUuid,
  });

  const workUpdated = await updateWorkFromPreview({
    client,
    workUuid,
    preview,
  });

  const titlesInserted = await insertTitlesFromPreview({
    client,
    preview,
  });

  const folioResult = await updateFolioAnnotationsFromPreview({
    client,
    workUuid,
    preview,
  });

  const passageResult = await insertPassagesFromPreview({
    client,
    preview,
  });

  return {
    counts: {
      workUpdates: workUpdated ? 1 : 0,
      titles: titlesInserted,
      folioUpdates: folioResult.updated,
      passages: passageResult.passages,
      annotations: passageResult.annotations,
    },
    warnings: folioResult.warning ? [folioResult.warning] : [],
  };
}
