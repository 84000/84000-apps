import {
  BODY_MATTER_FILTER,
  createBuildGraphQLClient,
  FRONT_MATTER_FILTER,
  getTranslationBlocks,
  getTranslationMetadataByUuid,
  getTranslationTitles,
} from '@eightyfourthousand/client-graphql/ssr';
import { ReaderBodyPanel } from './ReaderBodyPanel';
import { isPublishedStatus } from '@eightyfourthousand/data-access';
import { isUuid } from '@eightyfourthousand/lib-utils';
import { notFound } from 'next/navigation';

/**
 * Passages fetched per matter section for the first render.
 *
 * This was 250, which was never what it looked like: the API clamps a passage
 * connection to `MAX_PASSAGE_CONNECTION_LIMIT = 100`
 * (libs/data-access/src/lib/passage/pagination.ts), so the effective value has
 * always been 100 and raising the constant did nothing.
 *
 * Size is the reason to lower it. The reader's initial HTML is almost entirely
 * the inlined RSC flight payload — for the studio's prerendered pages, 1.48MB of
 * payload against 38 bytes of visible markup — and a hard navigation has to
 * render all of it client-side in one commit before the page responds to input.
 * A soft navigation does not, which is why clicking through to a translation
 * behaves while pasting its URL does not.
 *
 * Measured against production for toh12, per matter section:
 *
 *   n     body    front
 *   10    58KB    10KB
 *   25   134KB    32KB
 *   50   307KB    89KB
 *   100  597KB   169KB   (also what 250 and 500 return)
 *
 * 50 halves the body and front cost — about 370KB off toh12's ~1.34MB total —
 * while still seeding several screens. `PaginationProvider` backfills from the
 * scroll sentinels, so the only cost of a smaller window is an earlier first
 * backfill; correctness does not depend on this number.
 */
const INITIAL_PASSAGES = 50;

export const ReaderBodyPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  if (!isUuid(slug)) {
    return notFound();
  }

  const client = createBuildGraphQLClient();

  const { blocks: frontMatter, hasMoreAfter: frontMatterHasMore } =
    await getTranslationBlocks({
      client,
      uuid: slug,
      type: FRONT_MATTER_FILTER,
      maxPassages: INITIAL_PASSAGES,
    });

  const { blocks: body, hasMoreAfter: bodyHasMore } =
    await getTranslationBlocks({
      client,
      uuid: slug,
      type: BODY_MATTER_FILTER,
      maxPassages: INITIAL_PASSAGES,
    });

  const titles = await getTranslationTitles({ client, uuid: slug });

  const work = await getTranslationMetadataByUuid({ client, uuid: slug });

  return (
    <ReaderBodyPanel
      titles={titles}
      frontMatter={frontMatter}
      body={body}
      frontMatterHasMore={frontMatterHasMore}
      bodyHasMore={bodyHasMore}
      // Publication status is the authority here, not the version number and not the
      // presence of a snapshot: two public works have no snapshot because their legacy
      // label is not SemVer, and they are published all the same. Absent work is not a
      // judgement about publication, so it stays undefined.
      isPublished={work ? isPublishedStatus(work.publicationStatus) : undefined}
    />
  );
};
