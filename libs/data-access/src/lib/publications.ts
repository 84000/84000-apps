import { TranslationDTO, translationFromDTO } from './types';

export const getPublicationSlugs = async () => {
  // TODO: get from API, when available
  return ['toh251'];
};

export const getPublicationBySlug = async (slug: string) => {
  // TODO: get from API, when available
  if (slug !== 'toh251') {
    return null;
  }

  const res = await fetch(
    'https://ivwvvjgudwqwjbclvfjy.supabase.co/storage/v1/object/public/translations/toh251.json'
  );

  let json;

  try {
    json = await res.json();
  } catch (e) {
    console.error(`Failed to parse JSON for ${slug}`, e);
    // TODO:: remove this when data has been sanitized
    const text = await res.text();
    const escaped = text
      .replace(/(".*?)(\t)(.*?")/g, '$1\\t$3')
      .replace(/(".*?)(\n)(.*?")/g, '$1\\n$3')
      .replace(/(".*?)(\r\f\b)(.*?")/g, '$1$3');

    json = JSON.parse(escaped);
  }
  const dto = json as TranslationDTO;

  if (!dto) {
    return null;
  }

  const translation = translationFromDTO(dto);

  return translation;
};
