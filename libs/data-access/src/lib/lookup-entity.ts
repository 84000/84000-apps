import { createServerClient } from './client-ssr';
import { getBibliographyEntry } from './bibliography';
import { getPassage, getPassageUuidByXmlId } from './passage';
import {
  getTranslationMetadataByToh,
  getTranslationMetadataByUuid,
} from './publications';

const ALLOWED_TYPES = ['bibliography', 'passage', 'translation', 'work'];

export const lookupEntity = async (
  type: string,
  entity: string,
  xmlId?: string,
) => {
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

        path = `/publications/reader/${item.workUuid}?right=open%3Abibliography#${item.uuid}`;
      }
      break;
    case 'passage':
      {
        const item = await getPassage({ client, uuid: entity });
        if (!item?.workUuid || !item.uuid) {
          return;
        }

        path = `/publications/reader/${item.workUuid}#${item.uuid}`;
      }
      break;
    case 'translation':
      {
        const toh = entity.replace('.html', '');
        if (xmlId) {
          const item = await getPassageUuidByXmlId({ client, xmlId });

          if (item?.uuid && item?.workUuid) {
            const { uuid, workUuid } = item;
            path = `/publications/reader/${workUuid}#${uuid}`;
            return path;
          }
        }

        const item = await getTranslationMetadataByToh({ client, toh });
        if (!item?.uuid) {
          return;
        }

        path = `/publications/reader/${item.uuid}`;
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

        path = `/publications/reader/${item.uuid}`;
      }
      break;
    default: {
      return;
    }
  }

  return path;
};
