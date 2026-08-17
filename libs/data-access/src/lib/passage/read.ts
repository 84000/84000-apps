import {
  DataClient,
  PassageDTO,
  PassageRowDTO,
  annotationsFromDTO,
  passageFromDTO,
} from '../types';
import {
  DEFAULT_CONTENT_SOURCE,
  passageColumnsFor,
  relationFor,
  type ContentSource,
} from '../content-source';

import { PassageConnectionNode } from './pagination';

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
    annotationsFromDTO(dto?.annotations || [], dto?.content?.length || 0),
  );
};

export const getPassageByUuidOrXmlId = async ({
  client,
  uuid,
  xmlId,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  uuid?: string;
  xmlId?: string;
  source?: ContentSource;
}): Promise<PassageConnectionNode | null> => {
  if (!uuid && !xmlId) {
    return null;
  }

  // The published snapshot carries no xmlIds, so an xmlId lookup can only be
  // answered from draft. Callers resolving a hash deep link go through
  // `lookup()` for the same reason: it maps the xmlId to a UUID, which is
  // stable across both copies and then resolves in whichever source was asked
  // for.
  const effectiveSource = xmlId && !uuid ? 'draft' : source;

  let query = client
    .from(relationFor('passages', effectiveSource))
    .select<string, PassageRowDTO>(passageColumnsFor(effectiveSource));

  if (uuid) {
    query = query.eq('uuid', uuid);
  } else if (xmlId) {
    query = query.eq('xmlId', xmlId);
  }

  const { data, error } = await query.single();

  if (error) {
    console.error(`Error fetching passage ${uuid || xmlId}:`, error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    uuid: data.uuid,
    workUuid: data.work_uuid,
    content: data.content,
    label: data.label,
    sort: data.sort,
    type: data.type,
    toh: data.toh ?? null,
    xmlId: data.xmlId ?? null,
  };
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
