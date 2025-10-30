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

export const savePassages = async ({
  client,
  passages,
}: {
  client: DataClient;
  passages: Passage[];
}) => {
  /**
   * 1. Extract all annotations from savePassages
   * 2. Query the database for all current annotations for the savePassages
   * 3. Determine which annotations need to be deleted or upserted
   * 4. Upsert the passages
   * 5. Upsert the annotations
   * 6. Delete the annotations that are no longer present
   */
  const dtos = passagesToDTO(passages);
  const passageRowDtos = passagesToRowDTO(passages);
  const passageUuids = passages.map((p) => p.uuid);
  const annotations = dtos.flatMap((p) => p.annotations || []);

  const { data: existingAnnotations } = await client
    .from('passage_annotations')
    .select(`uuid`)
    .in('passage_uuid', passageUuids)
    .not('type', 'in', `(${ANNOTATIONS_TO_IGNORE.join(',')})`);

  const annotationsToDelete = existingAnnotations?.filter(
    (ea) => !annotations.find((a) => a.uuid === ea.uuid),
  );

  const { error: passageError } = await client
    .from('passages')
    .upsert(passageRowDtos, { onConflict: 'uuid' });

  if (passageError) {
    console.error('Error saving passages:', passageError);
    return;
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
