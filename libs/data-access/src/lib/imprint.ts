import {
  DataClient,
  Imprint,
  ImprintDTO,
  imprintFromDTO,
  tocFromDTO,
} from './types';

export const getTranslationToc = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data, error } = await client.rpc('get_work_toc', {
    work_uuid_input: uuid,
  });

  if (error) {
    console.error('Error fetching TOC:', error);
    return undefined;
  }

  return tocFromDTO(data || []);
};

export const getTranslationImprint = async ({
  client,
  uuid,
  toh,
}: {
  client: DataClient;
  uuid: string;
  toh: string;
}) => {
  const { data, error } = await client.rpc('get_imprint', {
    work_uuid: uuid,
    toh,
  });

  if (error || !data) {
    console.error('Error fetching imprint:', error);
    return undefined;
  }

  return imprintFromDTO(data);
};

export type ImprintKey = { uuid: string; toh: string };

export const imprintKey = ({ uuid, toh }: ImprintKey) => `${uuid}:${toh}`;

export const getTranslationImprints = async ({
  client,
  keys,
}: {
  client: DataClient;
  keys: readonly ImprintKey[];
}): Promise<Map<string, Imprint>> => {
  const imprintsByKey = new Map<string, Imprint>();
  if (keys.length === 0) {
    return imprintsByKey;
  }

  const { data, error } = await client.rpc('get_imprints', {
    work_uuids: keys.map(({ uuid }) => uuid),
    tohs: keys.map(({ toh }) => toh),
  });

  if (error || !data) {
    console.error('Error batch fetching imprints:', error);
    return imprintsByKey;
  }

  const rows = data as {
    work_uuid: string;
    toh: string;
    imprint: ImprintDTO | null;
  }[];
  for (const row of rows) {
    if (row.imprint) {
      imprintsByKey.set(
        imprintKey({ uuid: row.work_uuid, toh: row.toh }),
        imprintFromDTO(row.imprint),
      );
    }
  }

  return imprintsByKey;
};
