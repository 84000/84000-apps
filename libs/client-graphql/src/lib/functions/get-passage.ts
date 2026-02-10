import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { Passage } from '@data-access';
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

  query GetPassage($uuid: ID!) {
    passage(uuid: $uuid) {
      ...PassageWithAnnotations
    }
  }
`;

type GetPassageResponse = {
  passage: GraphQLPassage | null;
};

/**
 * Get a single passage by UUID.
 */
export async function getPassage({
  client,
  uuid,
}: {
  client: GraphQLClient;
  uuid: string;
}): Promise<Passage | undefined> {
  try {
    const response = await client.request<GetPassageResponse>(GET_PASSAGE, {
      uuid,
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
