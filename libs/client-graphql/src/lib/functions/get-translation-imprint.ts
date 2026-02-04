import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { Imprint } from '@data-access';
import { imprintFromGraphQL } from '../mappers';

const GET_WORK_WITH_IMPRINT = gql`
  fragment LicenseFields on License {
    name
    link
    description
  }

  fragment TitlesByLanguageFields on TitlesByLanguage {
    tibetan
    english
    wylie
    sanskrit
  }

  fragment ImprintFields on Imprint {
    toh
    section
    version
    restriction
    publishYear
    tibetanAuthors
    isAuthorContested
    sourceDescription
    publisherStatement
    tibetanTranslators
    license {
      ...LicenseFields
    }
    mainTitles {
      ...TitlesByLanguageFields
    }
    longTitles {
      ...TitlesByLanguageFields
    }
  }

  query GetWorkWithImprint($uuid: ID!, $toh: String) {
    work(uuid: $uuid, toh: $toh) {
      uuid
      imprint {
        ...ImprintFields
      }
    }
  }
`;

type GetWorkWithImprintResponse = {
  work: {
    uuid: string;
    imprint: {
      toh: string;
      section?: string | null;
      version?: string | null;
      restriction?: boolean | null;
      publishYear?: string | null;
      tibetanAuthors?: string[] | null;
      isAuthorContested: boolean;
      sourceDescription?: string | null;
      publisherStatement?: string | null;
      tibetanTranslators?: string | null;
      license: {
        name?: string | null;
        link?: string | null;
        description?: string | null;
      } | null;
      mainTitles?: {
        tibetan?: string | null;
        english?: string | null;
        wylie?: string | null;
        sanskrit?: string | null;
      } | null;
      longTitles?: {
        tibetan?: string | null;
        english?: string | null;
        wylie?: string | null;
        sanskrit?: string | null;
      } | null;
    } | null;
  } | null;
};

/**
 * Get the imprint for a translation work.
 */
export async function getTranslationImprint({
  client,
  uuid,
  toh,
}: {
  client: GraphQLClient;
  uuid: string;
  toh: string;
}): Promise<Imprint | undefined> {
  try {
    const response = await client.request<GetWorkWithImprintResponse>(
      GET_WORK_WITH_IMPRINT,
      { uuid, toh },
    );

    if (!response.work?.imprint) {
      return undefined;
    }

    return imprintFromGraphQL(response.work.imprint, response.work.uuid);
  } catch (error) {
    console.error('Error fetching translation imprint:', error);
    return undefined;
  }
}
