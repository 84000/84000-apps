import {
  type DataClient,
  type ImportPreview,
  assertImportTargetIsEmpty,
  insertPassagesFromPreview,
  insertTitlesFromPreview,
  updateFolioAnnotationsFromPreview,
  updateWorkFromPreview,
} from '@eightyfourthousand/data-access';

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
