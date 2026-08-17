import { DataClient } from '../types';
import {
  DEFAULT_CONTENT_SOURCE,
  relationFor,
  type ContentSource,
} from '../content-source';

export const getGlossaryDisplayNamesByUuids = async ({
  client,
  glossaryUuids,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  glossaryUuids: readonly string[];
  source?: ContentSource;
}): Promise<Map<string, string>> => {
  const namesByUuid = new Map<string, string>();
  if (glossaryUuids.length === 0) return namesByUuid;

  if (source === 'published') {
    // The snapshot has no `names` table to join: glossary_term_index already
    // flattened the term's own name into `english` (and `headword` when the term
    // has no English name), and that flattening is what freezes the published
    // display text against later edits to the shared name rows.
    const { data, error } = await client
      .from(relationFor('glossaryTerms', source))
      .select('glossary_uuid, english, headword')
      .in('glossary_uuid', glossaryUuids as string[]);

    if (error) {
      console.error('Error batch loading published glossary names:', error);
      return namesByUuid;
    }

    for (const term of data ?? []) {
      const content = term.english || term.headword;
      if (content) {
        namesByUuid.set(term.glossary_uuid, content);
      }
    }

    return namesByUuid;
  }

  // Draft reads the raw rows rather than the term index, because the index only
  // carries translationMain terms and mentions may target any of them.
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
