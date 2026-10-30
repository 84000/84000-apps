import {
  getPassageMetaPage,
  getTranslationBlocks,
} from '@eightyfourthousand/client-graphql/ssr';
import type { GraphQLClient } from 'graphql-request';

import {
  FIRST_PAGE,
  passageFromBlock,
  STACK_SECTIONS,
  type StackReaderSeed,
  type StackSectionSeed,
  type StackSeedPassage,
} from './stack-seed';

/**
 * Passages whose content is read with the seed. Enough for the first window a
 * server draws, its overscan included; the rest hydrate in the browser.
 */
const SEEDED_CONTENT = 40;

/** The tabs a first render draws rows in: the main panel's. */
const DRAWN_TABS = new Set(['front', 'translation']);

/**
 * Read what `StackReaderProvider` needs to build a work's stacks without a
 * request: each section's first page, and content for the first passages of
 * the sections drawn first.
 *
 * For a server: the seed is plain data for the provider's `seed` prop. A
 * section that fails to read is seeded empty, as the browser would leave it.
 */
export const loadStackReaderSeed = async ({
  client,
  workUuid,
}: {
  client: GraphQLClient;
  workUuid: string;
}): Promise<StackReaderSeed> => {
  const sections = await Promise.all(
    STACK_SECTIONS.map(async ({ tab, type }): Promise<StackSectionSeed> => {
      const [page, blocks] = await Promise.all([
        getPassageMetaPage({ client, uuid: workUuid, limit: FIRST_PAGE, type }),
        DRAWN_TABS.has(tab)
          ? getTranslationBlocks({
              client,
              uuid: workUuid,
              type,
              maxPassages: SEEDED_CONTENT,
            })
          : null,
      ]);
      const passages =
        blocks && !blocks.failed && Array.isArray(blocks.blocks)
          ? blocks.blocks
              .map(passageFromBlock)
              .filter((passage): passage is StackSeedPassage => !!passage)
          : [];
      return { tab, page, passages };
    }),
  );
  return { workUuid, sections };
};
