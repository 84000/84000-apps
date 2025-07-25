import { DataClient } from './types';
import {
  GlossaryDetailDTO,
  GlossaryEntityDTO,
  GlossaryInstanceDTO,
  glossaryPageItemFromDTO,
} from './types/glossary-page';

export const getGlossaryEntry = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data: details = [], error: detailError } = await client.rpc(
    'scholar_glossary_detail',
    { v_uuid: uuid },
  );

  if (detailError || !details?.length) {
    console.error('Error fetching glossary item:', detailError);
    return null;
  }

  const detail = details[0];

  const { data: entities = [], error: entitiesError } = await client.rpc(
    'scholar_glossary_detail_related_entities',
    { v_uuid: uuid },
  );
  if (entitiesError) {
    console.error('Error fetching related entities:', entitiesError);
  }

  const { data: glossaries = [], error: glossariesError } = await client.rpc(
    'scholar_glossary_detail_related_glossaries',
    { v_uuid: uuid },
  );
  if (glossariesError) {
    console.error('Error fetching related glossaries:', glossariesError);
  }

  return glossaryPageItemFromDTO(
    detail as GlossaryDetailDTO,
    glossaries as GlossaryInstanceDTO[],
    entities as GlossaryEntityDTO[],
  );
};
