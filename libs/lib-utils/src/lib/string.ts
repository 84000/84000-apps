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

// Tohoku numbers can carry a dash-separated sub-number ("toh1-2") and, less
// often, a letter suffix ("toh1006a"). Split them into numeric and non-numeric
// runs so each part is compared in turn, and only the first Toh in a list of
// them decides the order.
const tohParts = (toh: string) =>
  (toh.trim().split(/[\s,]+/)[0] || '').replace(/^toh/i, '').match(/\d+|\D+/g) ??
  [];

const comparePart = (a: string, b: string) => {
  const numA = Number.parseInt(a, 10);
  const numB = Number.parseInt(b, 10);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
    return numA - numB;
  }
  return a.localeCompare(b, 'en', { sensitivity: 'base' });
};

// Orders Tohoku numbers naturally: a value after a dash only breaks ties on the
// value before it, so "toh1-2" sorts next to "toh1", not next to "toh12".
export const compareToh = (a: string, b: string) => {
  const partsA = tohParts(a);
  const partsB = tohParts(b);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    if (partsA[i] === undefined) {
      return -1;
    }
    if (partsB[i] === undefined) {
      return 1;
    }
    const diff = comparePart(partsA[i], partsB[i]);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
};

export const stripLeadingArticles = (str: string) =>
  str.replace(/^(?:a|an|and|the)\s+/i, '');

export const compareIgnoringArticles = (a: string, b: string) =>
  stripLeadingArticles(a).localeCompare(stripLeadingArticles(b), 'en', {
    sensitivity: 'base',
  });

export const isUuid = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(str);

export const isXmlId = (str: string) =>
  /^UT\d+-\d+-\d+(-[\w]+)*$/.test(str);

/**
 * Escapes text for interpolation into HTML markup.
 *
 * Only the three characters that can break out of a text node — an attribute
 * value needs `escapeHtmlAttribute` instead.
 */
export const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Escapes text for interpolation into a double-quoted HTML attribute. */
export const escapeHtmlAttribute = (str: string) =>
  escapeHtml(str).replace(/"/g, '&quot;');
