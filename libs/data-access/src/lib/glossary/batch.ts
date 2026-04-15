import { DataClient } from '../types';

export const getGlossaryDisplayNamesByUuids = async ({
  client,
  glossaryUuids,
}: {
  client: DataClient;
  glossaryUuids: readonly string[];
}): Promise<Map<string, string>> => {
  const namesByUuid = new Map<string, string>();
  if (glossaryUuids.length === 0) return namesByUuid;

  const { data, error } = await client
    .from('glossaries')
    .select('uuid, names:names!name_uuid(content)')
    .in('uuid', glossaryUuids as string[]);

  if (error) {
    console.error('Error batch loading glossary names:', error);
    return namesByUuid;
  }

  for (const glossary of data ?? []) {
    const names = glossary.names as unknown as
      | { content: string }
      | { content: string }[]
      | null;
    const content = Array.isArray(names) ? names[0]?.content : names?.content;
    if (content) {
      namesByUuid.set(glossary.uuid, content);
    }
  }

  return namesByUuid;
};
