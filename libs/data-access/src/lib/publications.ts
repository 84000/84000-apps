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

  const json = await res.json();
  return json;
};
