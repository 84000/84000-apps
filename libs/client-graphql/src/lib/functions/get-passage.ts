import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { Passage } from '@eightyfourthousand/data-access';
import { passageFromGraphQL, type GraphQLPassage } from '../mappers';

const GET_PASSAGE = gql`
  fragment AnnotationFields on Annotation {
    uuid
    type
    start
    end
    metadata
  }

  fragment AlignmentFields on Alignment {
    folioUuid
    toh
    tibetan
    folioNumber
    volumeNumber
  }

  fragment PassageFields on Passage {
    uuid
    workUuid
    content
    label
    sort
    type
    xmlId
  }

  fragment PassageWithAnnotations on Passage {
    ...PassageFields
    annotations {
      ...AnnotationFields
    }
    alignments {
      ...AlignmentFields
    }
  }

  query GetPassage($uuid: ID, $xmlId: String) {
    passage(uuid: $uuid, xmlId: $xmlId) {
      ...PassageWithAnnotations
    }
  }
`;

type GetPassageResponse = {
  passage: GraphQLPassage | null;
};

/**
 * Get a single passage by UUID or XML ID.
 */
export async function getPassage({
  client,
  uuid,
  xmlId,
}: {
  client: GraphQLClient;
  uuid?: string;
  xmlId?: string;
}): Promise<Passage | undefined> {
  try {
    const response = await client.request<GetPassageResponse>(GET_PASSAGE, {
      uuid,
      xmlId,
    });

    if (!response.passage) {
      return undefined;
    }

    return passageFromGraphQL(response.passage);
  } catch (error) {
    console.error('Error fetching passage:', error);
    return undefined;
  }
}
