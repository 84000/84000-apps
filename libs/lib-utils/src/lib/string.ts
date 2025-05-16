export const removeDiacritics = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const camelCaseToHuman = (str: string) => {
  const result = str.replace(/([A-Z])/g, ' $1').trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
};

export const parseToh = (toh: string) =>
  toh.replace(/,/g, ', ').replace(/toh/g, 'Toh ');
