import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { GlossaryPageItem, TohokuCatalogEntry } from '@data-access';

const GET_GLOSSARY_ENTRY = gql`
  query GetGlossaryEntry($uuid: ID!) {
    glossaryEntry(uuid: $uuid) {
      authorityUuid
      headword
      language
      classifications
      definition
      xmlId
      english
      tibetan
      sanskrit
      pali
      chinese
      relatedInstances {
        workUuid
        toh
        definition
        canon
        english
        tibetan
        sanskrit
        pali
        chinese
        creators
      }
      relatedEntities {
        sourceHeadword
        sourceUuid
        targetHeadword
        targetUuid
      }
    }
  }
`;

type GraphQLGlossaryEntry = {
  authorityUuid: string;
  headword: string;
  language: string;
  classifications: string[];
  definition: string | null;
  xmlId: string | null;
  english: string[];
  tibetan: string[];
  sanskrit: string[];
  pali: string[];
  chinese: string[];
  relatedInstances: Array<{
    workUuid: string;
    toh: string;
    definition: string | null;
    canon: string | null;
    english: string[];
    tibetan: string[];
    sanskrit: string[];
    pali: string[];
    chinese: string[];
    creators: string[];
  }>;
  relatedEntities: Array<{
    sourceHeadword: string;
    sourceUuid: string;
    targetHeadword: string;
    targetUuid: string;
  }>;
};

type GetGlossaryEntryResponse = {
  glossaryEntry: GraphQLGlossaryEntry | null;
};

/**
 * Map GraphQL glossary entry to the GlossaryPageItem type.
 */
function glossaryEntryFromGraphQL(
  entry: GraphQLGlossaryEntry,
): GlossaryPageItem {
  return {
    authorityUuid: entry.authorityUuid,
    headword: entry.headword,
    language: entry.language as GlossaryPageItem['language'],
    classifications: entry.classifications,
    definition: entry.definition ?? undefined,
    xmlId: entry.xmlId ?? undefined,
    english: entry.english,
    tibetan: entry.tibetan,
    sanskrit: entry.sanskrit,
    pali: entry.pali,
    chinese: entry.chinese,
    relatedInstances: entry.relatedInstances.map((instance) => ({
      workUuid: instance.workUuid,
      toh: instance.toh as TohokuCatalogEntry,
      definition: instance.definition ?? undefined,
      canon: instance.canon ?? undefined,
      english: instance.english,
      tibetan: instance.tibetan,
      sanskrit: instance.sanskrit,
      pali: instance.pali,
      chinese: instance.chinese,
      creators: instance.creators,
    })),
    relatedEntities: entry.relatedEntities,
  };
}

/**
 * Get a single glossary entry by UUID (for the detail page).
 */
export async function getGlossaryEntry({
  client,
  uuid,
}: {
  client: GraphQLClient;
  uuid: string;
}): Promise<GlossaryPageItem | null> {
  try {
    const response = await client.request<GetGlossaryEntryResponse>(
      GET_GLOSSARY_ENTRY,
      { uuid },
    );

    if (!response.glossaryEntry) {
      return null;
    }

    return glossaryEntryFromGraphQL(response.glossaryEntry);
  } catch (error) {
    console.error('Error fetching glossary entry:', error);
    return null;
  }
}
