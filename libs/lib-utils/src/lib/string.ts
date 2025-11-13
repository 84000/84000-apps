export const removeDiacritics = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const removeHtmlTags = (str: string) =>
  str
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const camelCaseToHuman = (str: string) => {
  const result = str.replace(/([A-Z])/g, ' $1').trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
};

export const toSlug = (str: string) =>
  removeDiacritics(str)
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\- ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();

export const parseToh = (toh: string) =>
  toh.replace(/,/g, ', ').replace(/toh/g, 'Toh ');

export const isUuid = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(str);
