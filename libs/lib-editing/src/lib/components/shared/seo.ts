import { Work } from '@eightyfourthousand/data-access';
import { parseToh } from '@eightyfourthousand/lib-utils';

export const SITE_NAME = '84000: Translating the Words of the Buddha';
export const DEFAULT_READER_TITLE = '84000 Translation Reader';
export const DEFAULT_READER_DESCRIPTION =
  'Read translations from the Tibetan Buddhist canon published by 84000.';

export const getSiteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL || 'https://84000.co').replace(/\/$/, '');

export const getTranslationPath = (uuid: string) => `/${uuid}`;

export const getTranslationUrl = (uuid: string) =>
  `${getSiteUrl()}${getTranslationPath(uuid)}`;

export const getWorkDescription = (work: Work) => {
  const tohDisplay = work.toh.map(parseToh).join(', ');

  return (
    work.description ||
    [work.title, tohDisplay, work.section].filter(Boolean).join(' - ')
  );
};
