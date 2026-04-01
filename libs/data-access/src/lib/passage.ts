import {
  ANNOTATIONS_TO_IGNORE,
  DataClient,
  Passage,
  PassageDTO,
  annotationsFromDTO,
  passageFromDTO,
  passagesToDTO,
  passagesToRowDTO,
} from './types';

export const getPassage = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data } = await client
    .rpc('get_passage_with_annotations', {
      uuid_input: uuid,
    })
    .single();

  if (!data) {
    console.warn(`No passage found for uuid: ${uuid}`);
    return undefined;
  }

  const dto = data as PassageDTO;
  return passageFromDTO(
    dto,
    annotationsFromDTO(dto?.annotations || [], dto?.content.length || 0),
  );
};

export const getPassageUuidByXmlId = async ({
  client,
  xmlId,
}: {
  client: DataClient;
  xmlId: string;
}) => {
  const { data, error } = await client
    .from('passages')
    .select('uuid, workUuid:work_uuid')
    .eq('xmlId', xmlId)
    .single();

  if (error) {
    console.error(`Error fetching passage uuid for xmlId: ${xmlId}`, error);
    return;
  }

  return data?.uuid;
};

const PAGE_SIZE = 500;

async function normalizePassageLabelsAfter(
  client: DataClient,
  workUuid: string,
  fromSort: number,
  fromLabel: string,
  delta: number,
): Promise<void> {
  const parts = fromLabel.split('.');
  const depth = parts.length;
  const prefix = depth > 1 ? `${parts.slice(0, -1).join('.')}.` : '';
  let nextInt = Number.parseInt(parts[depth - 1], 10) + Math.max(delta, 0);

  let lastSort = fromSort;
  let done = false;

  while (!done) {
    const { data, error } = await client
      .from('passages')
      .select('uuid, label, sort')
      .eq('work_uuid', workUuid)
      .gt('sort', lastSort)
      .order('sort', { ascending: true })
      .limit(PAGE_SIZE);

    if (error || !data || data.length === 0) break;

    const labelUpdates: { uuid: string; label: string }[] = [];
    const prefixRenames: { oldPrefix: string; newPrefix: string }[] = [];

    for (const row of data) {
      const rowParts = (row.label ?? '').split('.');

      if (rowParts.length < depth) {
        done = true;
        break;
      }

      if (!row.label.startsWith(prefix)) {
        done = true;
        break;
      }

      if (rowParts.length > depth) {
        continue;
      }

      const expectedLabel = `${prefix}${nextInt}`;
      if (row.label === expectedLabel) {
        done = true;
        break;
      }

      labelUpdates.push({ uuid: row.uuid, label: expectedLabel });
      prefixRenames.push({
        oldPrefix: `${row.label}.`,
        newPrefix: `${expectedLabel}.`,
      });
      nextInt += 1;
    }

    if (labelUpdates.length > 0) {
      const { error: upsertError } = await client
        .from('passages')
        .upsert(labelUpdates, { onConflict: 'uuid' });

      if (upsertError) {
        console.error('Error normalizing passage labels:', upsertError);
      }

      for (const { oldPrefix, newPrefix } of prefixRenames) {
        const { error: prefixError } = await client.rpc(
          'rename_passage_label_prefix',
          {
            p_work_uuid: workUuid,
            p_old_prefix: oldPrefix,
            p_new_prefix: newPrefix,
          },
        );

        if (prefixError) {
          console.error('Error renaming passage label prefix:', prefixError);
        }
      }
    }

    if (done || data.length < PAGE_SIZE) break;
    lastSort = data[data.length - 1].sort;
  }
}

export const savePassagesWithStructure = async ({
  client,
  passages,
  deletedUuids = [],
}: {
  client: DataClient;
  passages: Passage[];
  deletedUuids?: string[];
}) => {
  const inputUuids = passages.map((passage) => passage.uuid);
  const { data: existingRows } =
    inputUuids.length > 0
      ? await client.from('passages').select('uuid').in('uuid', inputUuids)
      : { data: [] as { uuid: string }[] };

  const existingUuidSet = new Set((existingRows ?? []).map((row) => row.uuid));
  const newPassages = passages.filter((passage) => !existingUuidSet.has(passage.uuid));

  const sortedNewPassages = [...newPassages].sort((a, b) => b.sort - a.sort);

  for (const passage of sortedNewPassages) {
    const { error: shiftError } = await client.rpc('shift_passage_sorts', {
      p_work_uuid: passage.workUuid,
      p_from_sort: passage.sort,
      p_delta: 1,
    });

    if (shiftError) {
      console.error('Error shifting passage sorts:', shiftError);
    }
  }

  for (const passage of sortedNewPassages) {
    await normalizePassageLabelsAfter(
      client,
      passage.workUuid,
      passage.sort,
      passage.label,
      1,
    );
  }

  if (deletedUuids.length > 0) {
    const { data: deletedPassages } = await client
      .from('passages')
      .select('uuid, sort, label, work_uuid')
      .in('uuid', deletedUuids);

    if (deletedPassages && deletedPassages.length > 0) {
      const sortedDeletedPassages = [...deletedPassages].sort(
        (a, b) => b.sort - a.sort,
      );

      for (const deletedPassage of sortedDeletedPassages) {
        await normalizePassageLabelsAfter(
          client,
          deletedPassage.work_uuid,
          deletedPassage.sort,
          deletedPassage.label,
          -1,
        );
      }

      const { error: deleteAnnotationsError } = await client
        .from('passage_annotations')
        .delete()
        .in('passage_uuid', deletedUuids);

      if (deleteAnnotationsError) {
        console.error(
          'Error deleting annotations for deleted passages:',
          deleteAnnotationsError,
        );
      }

      const { error: deletePassagesError } = await client
        .from('passages')
        .delete()
        .in('uuid', deletedUuids);

      if (deletePassagesError) {
        console.error('Error deleting passages:', deletePassagesError);
        throw deletePassagesError;
      }
    }
  }

  const dtos = passagesToDTO(passages);
  const passageRowDtos = passagesToRowDTO(passages);
  const passageUuids = passages.map((p) => p.uuid);
  const annotations = dtos.flatMap((p) => p.annotations || []);

  const { data: existingAnnotations } =
    passageUuids.length > 0
      ? await client
          .from('passage_annotations')
          .select(`uuid`)
          .in('passage_uuid', passageUuids)
          .not('type', 'in', `(${ANNOTATIONS_TO_IGNORE.join(',')})`)
      : { data: [] as { uuid: string }[] };

  const annotationsToDelete = existingAnnotations?.filter(
    (ea) => !annotations.find((a) => a.uuid === ea.uuid),
  );

  if (passageRowDtos.length > 0) {
    const { error: passageError } = await client
      .from('passages')
      .upsert(passageRowDtos, { onConflict: 'uuid' });

    if (passageError) {
      console.error('Error saving passages:', passageError);
      throw passageError;
    }
  }

  if (annotations.length > 0) {
    const { error: annotationError } = await client
      .from('passage_annotations')
      .upsert(annotations, { onConflict: 'uuid' });

    if (annotationError) {
      console.error('Error saving annotations:', annotationError);
      throw annotationError;
    }
  }

  if (annotationsToDelete && annotationsToDelete.length > 0) {
    const { error: deleteError } = await client
      .from('passage_annotations')
      .delete()
      .in(
        'uuid',
        annotationsToDelete.map((a) => a.uuid),
      );

    if (deleteError) {
      console.error('Error deleting annotations:', deleteError);
      throw deleteError;
    }
  }
};

export const savePassages = async ({
  client,
  passages,
}: {
  client: DataClient;
  passages: Passage[];
}) => {
  return savePassagesWithStructure({
    client,
    passages,
  });
};
