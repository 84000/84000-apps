import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { Work } from '@data-access';
import { workFromGraphQL } from '../mappers';

const GET_WORK_BY_UUID = gql`
  query GetWorkByUuid($uuid: ID!) {
    work(uuid: $uuid) {
      uuid
      title
      toh
      publicationDate
      publicationVersion
      pages
      restriction
      section
    }
  }
`;

const GET_WORK_BY_TOH = gql`
  query GetWorkByToh($toh: String!) {
    work(toh: $toh) {
      uuid
      title
      toh
      publicationDate
      publicationVersion
      pages
      restriction
      section
    }
  }
`;

type GetWorkResponse = {
  work: {
    uuid: string;
    title: string;
    toh: string[];
    publicationDate: string;
    publicationVersion: string;
    pages: number;
    restriction: boolean;
    section: string;
  } | null;
};

/**
 * Get work metadata by UUID.
 */
export async function getTranslationMetadataByUuid({
  client,
  uuid,
}: {
  client: GraphQLClient;
  uuid: string;
}): Promise<Work | null> {
  try {
    const response = await client.request<GetWorkResponse>(GET_WORK_BY_UUID, {
      uuid,
    });

    if (!response.work) {
      return null;
    }

    return workFromGraphQL(response.work);
  } catch (error) {
    console.error('Error fetching translation metadata by UUID:', error);
    return null;
  }
}

/**
 * Get work metadata by Tohoku catalog number.
 */
export async function getTranslationMetadataByToh({
  client,
  toh,
}: {
  client: GraphQLClient;
  toh: string;
}): Promise<Work | null> {
  try {
    const response = await client.request<GetWorkResponse>(GET_WORK_BY_TOH, {
      toh,
    });

    if (!response.work) {
      return null;
    }

    return workFromGraphQL(response.work);
  } catch (error) {
    console.error('Error fetching translation metadata by toh:', error);
    return null;
  }
}
