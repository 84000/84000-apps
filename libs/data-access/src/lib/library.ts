import {
  DataClient,
  LibraryItemType,
  UserLibraryItem,
  UserPassageItem,
} from './types';

export const updateUserProfile = async ({
  client,
  userId,
  avatar,
  name,
  username,
  subscriptions,
}: {
  client: DataClient;
  userId: string;
  subscriptions: string[];
  avatar?: string;
  name?: string;
  username?: string;
}): Promise<boolean> => {
  const { error } = await client
    .from('user_profiles')
    .update({
      avatar_url: avatar,
      full_name: name,
      username: username,
      subscriptions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user subscriptions:', error);
    return false;
  }

  return true;
};

export const getUserLibrary = async ({
  client,
  userId,
}: {
  client: DataClient;
  userId: string;
}): Promise<UserLibraryItem[]> => {
  const { data, error } = await client
    .from('user_libraries')
    .select(
      `
        uuid:entity_id::uuid,
        type:entity_type::text,
        createdAt:created_at::text,
        featured::bool
      `,
    )
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user library:', error);
    return [];
  }

  return (data || []) as UserLibraryItem[];
};

export const addUserLibraryItem = async ({
  client,
  userId,
  type,
  entityId,
}: {
  client: DataClient;
  userId: string;
  type: LibraryItemType;
  entityId: string;
}): Promise<boolean> => {
  const { error } = await client.from('user_libraries').insert({
    user_id: userId,
    entity_id: entityId,
    entity_type: type,
    featured: true,
  });

  if (error) {
    console.error('Error adding to user library:', error);
    return false;
  }

  return true;
};

export const removeUserLibraryItem = async ({
  client,
  entityId,
}: {
  client: DataClient;
  entityId: string;
}): Promise<boolean> => {
  const { error } = await client
    .from('user_libraries')
    .delete()
    .eq('entity_id', entityId);

  if (error) {
    console.error('Error removing from user library:', error);
    return false;
  }

  return true;
};

export const getUserBibliographies = async ({
  client,
  uuids,
}: {
  client: DataClient;
  uuids: string[];
}) => {
  const { data, error } = await client
    .from('bibliographies')
    .select(
      `
      uuid::text,
      toh::text,
      text:bibl_text::text
    `,
    )
    .in('uuid', uuids);

  if (error) {
    console.error('Error fetching user bibliographies:', error);
    return [];
  }

  return data || [];
};

export const getUserPassages = async ({
  client,
  uuids,
}: {
  client: DataClient;
  uuids: string[];
}) => {
  const { data, error } = await client
    .from('passages')
    .select(
      `
      uuid::text,
      content::text,
      label::text,
      work:works(
        toh::text,
        uuid::text
      )
    `,
    )
    .in('uuid', uuids);
  if (error) {
    console.error('Error fetching user passages:', error);
    return [];
  }

  // NOTE: Supabase incorrectly infers `work` as an array. We have to jump
  // though the hoop of casting to inknown first.
  return (data || []) as unknown as UserPassageItem[];
};

export const getUserPublications = async ({
  client,
  uuids,
}: {
  client: DataClient;
  uuids: string[];
}) => {
  const { data, error } = await client
    .from('works')
    .select(
      `
      uuid::text,
      title::text,
      toh::text,
      titles(content::text,language::text),
      sections:catalog_works(...catalogs(label::text))
    `,
    )
    .like('titles.type', '%mainTitle')
    .in('titles.language', ['bo', 'en'])
    .in('uuid', uuids);

  if (error) {
    console.error('Error fetching user publications:', error);
    return [];
  }

  return data || [];
};

export const getUserSearches = async (_: {
  client: DataClient;
  uuids: string[];
}) => {
  // TODO: Support saving and retrieving user searches
  console.warn('getUserSearches not implemented yet');
  return [] as { uuid: string; name: string; query: string }[];
};
