import {
  DataClient,
  PassageDTO,
  annotationsFromDTO,
  passageFromDTO,
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
  return passageFromDTO(dto, annotationsFromDTO(dto?.annotations || []));
};
