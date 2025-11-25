import { createServerClient } from './client-ssr';
import { getBibliographyEntry } from './bibliography';
import { getPassage, getPassageUuidByXmlId } from './passage';
import {
  getTranslationMetadataByToh,
  getTranslationMetadataByUuid,
} from './publications';
import { BodyItemType } from './types';

const ALLOWED_TYPES = ['bibliography', 'passage', 'translation', 'work'];
const TAB_FOR_PASSAGE_SECTION: Partial<Record<BodyItemType, string>> = {
  abbreviations: 'abbreviations',
  endnotes: 'endnotes',
  summary: 'front',
  introduction: 'front',
  acknowledgements: 'front',
};

const PANEL_FOR_PASSAGE_SECTION: Partial<Record<BodyItemType, string>> = {
  abbreviations: 'right',
  endnotes: 'right',
};

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

        const section = item.type.replace('Header', '') as BodyItemType;
        const panel = PANEL_FOR_PASSAGE_SECTION[section] || 'main';
        const tab = TAB_FOR_PASSAGE_SECTION[section] || 'translation';
        path = `${prefix}/${item.workUuid}?${item.toh ? `toh=${item.toh}&` : ''}${panel}=open%3A${tab}%3A${item.uuid}`;
      }
      break;
    case 'translation':
      {
        const toh = entity.replace('.html', '');
        if (xmlId) {
          const item = await getPassageUuidByXmlId({ client, xmlId });

          const section = item.type.replace('Header', '') as BodyItemType;
          const panel = PANEL_FOR_PASSAGE_SECTION[section] || 'main';
          const tab = TAB_FOR_PASSAGE_SECTION[section] || 'translation';

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
