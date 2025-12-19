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
}: {
  type: string;
  entity: string;
  prefix?: string;
  xmlId?: string;
}) => {
  if (!ALLOWED_TYPES.includes(type)) {
    return;
  }
  const client = await createServerClient();
  let path = '';

  switch (type) {
    case 'bibliography':
      {
        const item = await getBibliographyEntry({ client, uuid: entity });
        if (!item?.workUuid || !item.uuid) {
          return;
        }

        path = `${prefix}/${item.workUuid}?right=open%3Abibliography%3A${item.uuid}`;
      }
      break;
    case 'passage':
      {
        const item = await getPassage({ client, uuid: entity });
        if (!item?.workUuid || !item.uuid) {
          return;
        }

        const { panel, tab } = panelAndTabForContentType(item.type);
        path = `${prefix}/${item.workUuid}?${item.toh ? `toh=${item.toh}&` : ''}${panel}=open%3A${tab}%3A${item.uuid}`;
      }
      break;
    case 'translation':
      {
        const toh = entity.replace('.html', '');
        if (xmlId) {
          const item = await getPassageUuidByXmlId({ client, xmlId });
          const { panel, tab } = panelAndTabForContentType(item.type);

          if (item?.uuid && item?.workUuid) {
            const { uuid, workUuid } = item;
            path = `${prefix}/${workUuid}?toh=${toh}&${panel}=open%3A${tab}%3A${uuid}`;
            return path;
          }
        }

        const item = await getTranslationMetadataByToh({ client, toh });
        if (!item?.uuid) {
          return;
        }

        path = `${prefix}/${item.uuid}?toh=${toh}`;
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

        path = `${prefix}/${item.uuid}`;
      }
      break;
    default: {
      return;
    }
  }

  return path;
};
