import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { Toc } from '@data-access';
import { tocFromGraphQL } from '../mappers';

const GET_WORK_WITH_TOC = gql`
  fragment TocEntryFields on TocEntry {
    uuid
    content
    label
    sort
    level
    section
  }

  fragment TocEntryNested on TocEntry {
    ...TocEntryFields
    children {
      ...TocEntryFields
      children {
        ...TocEntryFields
        children {
          ...TocEntryFields
          children {
            ...TocEntryFields
            children {
              ...TocEntryFields
            }
          }
        }
      }
    }
  }

  fragment TocFields on Toc {
    frontMatter {
      ...TocEntryNested
    }
    body {
      ...TocEntryNested
    }
    backMatter {
      ...TocEntryNested
    }
  }

  query GetWorkWithToc($uuid: ID!) {
    work(uuid: $uuid) {
      uuid
      toc {
        ...TocFields
      }
    }
  }
`;

type GetWorkWithTocResponse = {
  work: {
    uuid: string;
    toc: {
      frontMatter: TocEntryNode[];
      body: TocEntryNode[];
      backMatter: TocEntryNode[];
    } | null;
  } | null;
};

type TocEntryNode = {
  uuid: string;
  content: string;
  label?: string | null;
  sort: number;
  level: number;
  section: string;
  children?: TocEntryNode[] | null;
};

/**
 * Get the table of contents for a translation work.
 */
export async function getTranslationToc({
  client,
  uuid,
}: {
  client: GraphQLClient;
  uuid: string;
}): Promise<Toc | undefined> {
  try {
    const response = await client.request<GetWorkWithTocResponse>(
      GET_WORK_WITH_TOC,
      { uuid },
    );

    if (!response.work?.toc) {
      return undefined;
    }

    return tocFromGraphQL(response.work.toc);
  } catch (error) {
    console.error('Error fetching translation TOC:', error);
    return undefined;
  }
}
