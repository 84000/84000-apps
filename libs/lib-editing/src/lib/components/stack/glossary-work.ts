import type { JSONContent } from '@tiptap/core';
import type { GraphQLClient } from 'graphql-request';
import {
  getGlossaryEntries,
  getWorkGlossaryTermsPage,
  type DataClient,
  type GlossaryEntry,
  type GlossaryTermNode,
} from '@eightyfourthousand/data-access';
import { htmlToText } from '@eightyfourthousand/lib-utils';
import {
  GLOSSARY_ROW_TYPE,
  type WorkDocument,
} from '@eightyfourthousand/lib-doc-model';

import {
  glossaryContentToDefinition,
  glossaryRowSource,
} from './glossary-codec';
import { buildGlossarySchemaExtensions } from './glossary-extensions';
import { RowFeed, type RowMeta, type RowPages } from './spine-feed';
import { createStackWork } from './stack-work';

/** The label prefix glossary rows carry, as the readers number them. */
export const GLOSSARY_LABEL_PREFIX = 'g.';

/** The most entries one page of the glossary read returns. */
const MAX_PAGE = 200;

/**
 * Characters a row's names take, for estimating its height before it is read:
 * about three lines of them above the definition.
 */
const NAMES_LENGTH = 230;

/** A glossary as a stack work, and the entries its rows were read from. */
export type GlossaryWork = {
  work: WorkDocument;
  /** Grows the rows a page at a time, in the readers' order. */
  feed: RowFeed;
  /** The entries as read, by uuid, for rows whose documents are held. */
  entries: Map<string, GlossaryEntry>;
};

/** A term as a row: labelled and ordered as the readers number it. */
const rowMetaOf = (node: GlossaryTermNode): RowMeta => ({
  uuid: node.uuid,
  label: `${GLOSSARY_LABEL_PREFIX}${node.termNumber}`,
  type: GLOSSARY_ROW_TYPE,
  sort: node.termNumber,
  contentLength: NAMES_LENGTH + htmlToText(node.definition ?? '').length,
});

/** A work's glossary as pages of rows, in the readers' order. */
export const glossaryPages = ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): RowPages => ({
  async metas({ cursor, limit, direction }) {
    const { nodes, pageInfo } = await getWorkGlossaryTermsPage({
      client,
      workUuid,
      cursor,
      direction: direction ?? 'FORWARD',
      limit: Math.min(limit, MAX_PAGE),
      source: 'draft',
    });
    return {
      metas: nodes.map(rowMetaOf),
      nextCursor: pageInfo.nextCursor ?? undefined,
      prevCursor: pageInfo.prevCursor ?? undefined,
      hasMoreAfter: pageInfo.hasMoreAfter,
      hasMoreBefore: pageInfo.hasMoreBefore,
    };
  },
  // Rows are read through the work's source, never past the window.
  content: async () => null,
});

/** A row's static HTML: its definition as stored. */
export const renderGlossaryRow = (doc: JSONContent): string =>
  glossaryContentToDefinition(doc.content ?? []) ?? '';

/**
 * A work's glossary as its own stack work, with its first page of rows.
 *
 * Rows are read a page at a time, and each row's entry when its document is
 * hydrated. An entry is kept as read while its document is held, so a save
 * is checked against what its editor started from. Null when the glossary
 * could not be read or has no entries; never throws.
 */
export const loadGlossaryWork = async ({
  workUuid,
  client,
  graphql,
}: {
  workUuid: string;
  client: DataClient;
  graphql: GraphQLClient;
}): Promise<GlossaryWork | null> => {
  const entries = new Map<string, GlossaryEntry>();
  // The source reads before the work exists to name it.
  const built: { work?: WorkDocument } = {};
  const work = createStackWork({
    workUuid,
    client: graphql,
    source: glossaryRowSource({
      workUuid,
      read: async (uuids) => {
        const read = await getGlossaryEntries({ client, workUuid, uuids });
        if (!read) return [];
        return read.flatMap((entry) => {
          // A held document keeps the entry it was read from.
          if (built.work?.store.has(entry.uuid)) return [];
          entries.set(entry.uuid, entry);
          return [{ uuid: entry.uuid, definition: entry.definition }];
        });
      },
    }),
    extensions: buildGlossarySchemaExtensions(),
  });
  built.work = work;
  const feed = new RowFeed(work, glossaryPages({ client, workUuid }));
  const rows = await feed.seed().catch((error: unknown) => {
    console.error('Failed to read glossary:', error);
    return 0;
  });
  if (!rows) {
    work.destroy();
    return null;
  }
  return { work, feed, entries };
};
