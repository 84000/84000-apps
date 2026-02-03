import { createServerClient } from './client-ssr';
import { getBibliographyEntry } from './bibliography';
import { getPassage, getPassageUuidByXmlId } from './passage';
import {
  getTranslationMetadataByToh,
  getTranslationMetadataByUuid,
} from './publications';
import { panelAndTabForContentType } from './layout';

const ALLOWED_TYPES = ['bibliography', 'passage', 'translation', 'work'];

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
}) => {
  if (!ALLOWED_TYPES.includes(type)) {
    return;
  }
  const client = await createServerClient();
  let path = '';
  const query = searchParams || new URLSearchParams();

  switch (type) {
    case 'bibliography':
      {
        const item = await getBibliographyEntry({ client, uuid: entity });
        if (!item?.workUuid || !item.uuid) {
          return;
        }

        query.set('right', `open:bibliography:${item.uuid}`);
        path = `${prefix}/${item.workUuid}?${query.toString()}`;
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
        query.set(panel, `open:${tab}:${item.uuid}`);
        if (item.toh) {
          query.set('toh', item.toh);
        }

        path = `${prefix}/${item.workUuid}?${query.toString()}`;
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

          if (item?.uuid && item?.workUuid) {
            const { uuid, workUuid } = item;
            query.delete('tab');
            query.set(panel, `open:${tab}:${uuid}`);

            path = `${prefix}/${workUuid}?${query.toString()}`;
            return path;
          }
        }

        const item = await getTranslationMetadataByToh({ client, toh });
        if (!item?.uuid) {
          return;
        }

        path = `${prefix}/${item.uuid}?${query.toString()}`;
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

        path = `${prefix}/${item.uuid}?${query.toString()}`;
      }
      break;
    default: {
      return;
    }
  }

  return path;
};
