import { DataClient } from './types';

export const LOOKUP_ENTITY_TYPES = [
  'work',
  'passage',
  'glossary',
  'bibliography',
] as const;

export type LookupEntityType = (typeof LOOKUP_ENTITY_TYPES)[number];

export type LookupResult = {
  uuid: string;
  type: LookupEntityType;
};

const isLookupEntityType = (
  type: string | null | undefined,
): type is LookupEntityType =>
  LOOKUP_ENTITY_TYPES.includes(type as LookupEntityType);

const lookupWorkByToh = async ({
  client,
  toh,
}: {
  client: DataClient;
  toh: string;
}): Promise<LookupResult | null> => {
  const { data, error } = await client
    .from('work_toh')
    .select('work_uuid')
    .eq('toh_clean', toh)
    .maybeSingle();

  if (error) {
    console.error(`Error looking up work by toh ${toh}:`, error);
    return null;
  }

  return data?.work_uuid ? { uuid: data.work_uuid, type: 'work' } : null;
};

const lookupUuidInTable = async ({
  client,
  table,
  type,
  uuid,
}: {
  client: DataClient;
  table: string;
  type: LookupEntityType;
  uuid: string;
}): Promise<LookupResult | null> => {
  const { data, error } = await client
    .from(table)
    .select('uuid')
    .eq('uuid', uuid)
    .maybeSingle();

  if (error) {
    console.error(`Error looking up ${type} by uuid ${uuid}:`, error);
    return null;
  }

  return data?.uuid ? { uuid: data.uuid, type } : null;
};

const lookupXmlIdInTable = async ({
  client,
  table,
  column,
  type,
  xmlId,
}: {
  client: DataClient;
  table: string;
  column: string;
  type: LookupEntityType;
  xmlId: string;
}): Promise<LookupResult | null> => {
  const { data, error } = await client
    .from(table)
    .select('uuid')
    .eq(column, xmlId)
    .maybeSingle();

  if (error) {
    console.error(`Error looking up ${type} by xmlId ${xmlId}:`, error);
    return null;
  }

  return data?.uuid ? { uuid: data.uuid, type } : null;
};

const TABLE_BY_TYPE: Record<LookupEntityType, string> = {
  work: 'works',
  passage: 'passages',
  glossary: 'glossaries',
  bibliography: 'bibliographies',
};

const XML_ID_COLUMN_BY_TYPE: Record<LookupEntityType, string> = {
  work: 'xmlId',
  passage: 'xmlId',
  glossary: 'glossary_xmlId',
  bibliography: 'xmlId',
};

const LOOKUP_ORDER: LookupEntityType[] = [
  'work',
  'passage',
  'glossary',
  'bibliography',
];

export const lookup = async ({
  client,
  toh,
  uuid,
  xmlId,
  type,
}: {
  client: DataClient;
  toh?: string | null;
  uuid?: string | null;
  xmlId?: string | null;
  type?: string | null;
}): Promise<LookupResult | null> => {
  const scopedTypes = isLookupEntityType(type) ? [type] : LOOKUP_ORDER;

  if (toh) {
    if (type && type !== 'work') {
      return null;
    }
    return lookupWorkByToh({ client, toh });
  }

  if (uuid) {
    for (const lookupType of scopedTypes) {
      const result = await lookupUuidInTable({
        client,
        table: TABLE_BY_TYPE[lookupType],
        type: lookupType,
        uuid,
      });
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (xmlId) {
    for (const lookupType of scopedTypes) {
      const result = await lookupXmlIdInTable({
        client,
        table: TABLE_BY_TYPE[lookupType],
        column: XML_ID_COLUMN_BY_TYPE[lookupType],
        type: lookupType,
        xmlId,
      });
      if (result) {
        return result;
      }
    }
  }

  return null;
};
