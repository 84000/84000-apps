import {
  getPassageMetaPage,
  getTranslationBlocks,
  getWorkBibliography,
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
 * Passages per section whose content is read with the seed. Enough for the
 * first window a server draws, its overscan included; the rest hydrate in the
 * browser.
 */
const SEEDED_CONTENT = 40;

/**
 * Read what `StackReaderProvider` needs to build a work's stacks without a
 * request: each section's first page, and content for its first passages.
 *
 * Every section's first window is drawn on the server, the right panel's
 * included while it is closed, so the page carries some of each. The
 * bibliography is read whole, as readers see it, as the paginated reader reads
 * it.
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
  const reading = getWorkBibliography({ client, uuid: workUuid });
  const sections = await Promise.all(
    STACK_SECTIONS.map(async ({ tab, type }): Promise<StackSectionSeed> => {
      const [page, blocks] = await Promise.all([
        getPassageMetaPage({ client, uuid: workUuid, limit: FIRST_PAGE, type }),
        getTranslationBlocks({
          client,
          uuid: workUuid,
          type,
          maxPassages: SEEDED_CONTENT,
        }),
      ]);
      const passages =
        !blocks.failed && Array.isArray(blocks.blocks)
          ? blocks.blocks
              .map(passageFromBlock)
              .filter((passage): passage is StackSeedPassage => !!passage)
          : [];
      return { tab, page, passages };
    }),
  );
  return { workUuid, sections, bibliography: await reading };
};
