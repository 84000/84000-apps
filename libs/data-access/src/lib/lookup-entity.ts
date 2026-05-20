import { createServerClient } from './client-ssr';
import { getBibliographyEntry } from './bibliography';
import { getPassage, getPassageUuidByXmlId } from './passage';
import {
  getTranslationMetadataByToh,
  getTranslationMetadataByUuid,
} from './publications';
import { panelAndTabForContentType } from './panel-url';
import { getGlossaryInstance } from './glossary';
import { DataClient } from './types';

const ALLOWED_TYPES = [
  'bibliography',
  'glossary',
  'passage',
  'translation',
  'work',
];

export interface LookupEntityReturnType {
  path: string;
  uuid: string;
  workUuid: string;
  query: URLSearchParams;
}

export const lookupEntity = async ({
  type,
  entity,
  prefix = '',
  xmlId,
  searchParams,
}: {
  type: string;
  entity: string;
  prefix?: string;
  xmlId?: string;
  searchParams?: URLSearchParams;
}): Promise<LookupEntityReturnType | undefined> => {
  if (!ALLOWED_TYPES.includes(type)) {
    return;
  }
  const client = await createServerClient();
  return await lookupEntityWithClient({
    client,
    type,
    entity,
    prefix,
    xmlId,
    searchParams,
  });
};

export const lookupEntityWithClient = async ({
  client,
  type,
  entity,
  prefix = '',
  xmlId,
  searchParams,
}: {
  client: DataClient;
  type: string;
  entity: string;
  prefix?: string;
  xmlId?: string;
  searchParams?: URLSearchParams;
}): Promise<LookupEntityReturnType | undefined> => {
  let path: string | undefined;
  let workUuid: string | undefined;
  let uuid: string | undefined;

  const query = searchParams || new URLSearchParams();

  switch (type) {
    case 'bibliography':
      {
        const item = await getBibliographyEntry({ client, uuid: entity });
        if (!item?.workUuid || !item.uuid) {
          return;
        }

        workUuid = item.workUuid;
        uuid = item.uuid;
        query.set('right', `open:bibliography:${uuid}`);
        path = `${prefix}/${workUuid}?${query.toString()}`;
      }
      break;
    case 'glossary':
      {
        const item = await getGlossaryInstance({ client, uuid: entity });
        if (!item?.workUuid || !item.uuid) {
          return;
        }

        workUuid = item.workUuid;
        uuid = item.uuid;
        query.set('right', `open:glossary:${uuid}`);
        path = `${prefix}/${workUuid}?${query.toString()}`;
      }
      break;
    case 'passage':
      {
        const item = await getPassage({ client, uuid: entity });
        if (!item?.workUuid || !item.uuid) {
          return;
        }

        const queryTab = query.get('tab') || undefined;
        const { panel, tab } = panelAndTabForContentType(item.type, queryTab);

        query.delete('tab');
        query.set(panel, `open:${tab}:${uuid}`);
        if (item.toh) {
          query.set('toh', item.toh);
        }

        path = `${prefix}/${workUuid}?${query.toString()}`;
      }
      break;
    case 'translation':
      {
        const toh = entity.replace('.html', '');
        query.set('toh', toh);

        if (xmlId) {
          const item = await getPassageUuidByXmlId({ client, xmlId });
          const queryTab = query.get('tab') || undefined;
          const { panel, tab } = panelAndTabForContentType(item.type, queryTab);

          uuid = item?.uuid;
          workUuid = item?.workUuid;

          if (uuid && workUuid) {
            query.delete('tab');
            query.set(panel, `open:${tab}:${uuid}`);

            path = `${prefix}/${workUuid}?${query.toString()}`;
            return { path, uuid, workUuid, query };
          }
        }

        const item = await getTranslationMetadataByToh({ client, toh });

        if (!item?.uuid) {
          return;
        }

        uuid = item.uuid;
        workUuid = item.uuid;
        path = `${prefix}/${uuid}?${query.toString()}`;
      }
      break;
    case 'work':
      {
        const item = await getTranslationMetadataByUuid({
          client,
          uuid: entity,
        });
        if (!item?.uuid) {
          return;
        }

        uuid = item.uuid;
        workUuid = item.uuid;
        path = `${prefix}/${item.uuid}?${query.toString()}`;
      }
      break;
    default: {
      return;
    }
  }

  if (!path || !uuid || !workUuid) {
    return;
  }

  return { path, uuid, workUuid, query };
};
