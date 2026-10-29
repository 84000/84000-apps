import {
  BODY_MATTER_FILTER,
  createBuildGraphQLClient,
  getTranslationBlocks,
  getTranslationMetadataByUuid,
  getTranslationTitles,
} from '@eightyfourthousand/client-graphql/ssr';
import {
  isPublishedStatus,
  type TranslationEditorContent,
} from '@eightyfourthousand/data-access';
import { isUuid } from '@eightyfourthousand/lib-utils';
import { notFound } from 'next/navigation';
import { StackReaderProvider } from '../stack/StackReaderProvider';
import { loadStackReaderSeed } from '../stack/stack-reader-seed';
import { StackReaderBodyPanel } from './StackReaderBodyPanel';

/**
 * How far into the translation a reader looks for alignments to offer Compare:
 * as far as the paginated reader's first read.
 */
const ALIGNMENT_WINDOW = 250;

/**
 * The translation's first passages as the panel reads them: their uuid and
 * alignments, without their content, which the stack draws.
 */
const translationOf = (
  blocks: TranslationEditorContent,
): TranslationEditorContent =>
  (Array.isArray(blocks) ? blocks : []).map(({ attrs }) => ({
    type: 'passage',
    attrs: { uuid: attrs?.uuid, alignments: attrs?.alignments ?? {} },
  }));

/**
 * The reader's main panel drawn as passage stacks, their first rows rendered
 * on the server. `ReaderBodyPage`'s counterpart: same route, same tabs.
 */
export const StackReaderBodyPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  if (!isUuid(slug)) {
    return notFound();
  }

  const client = createBuildGraphQLClient();
  const [seed, translation, titles, work] = await Promise.all([
    loadStackReaderSeed({ client, workUuid: slug }),
    getTranslationBlocks({
      client,
      uuid: slug,
      type: BODY_MATTER_FILTER,
      maxPassages: ALIGNMENT_WINDOW,
    }),
    getTranslationTitles({ client, uuid: slug }),
    getTranslationMetadataByUuid({ client, uuid: slug }),
  ]);

  return (
    <StackReaderProvider workUuid={slug} seed={seed}>
      <StackReaderBodyPanel
        titles={titles}
        body={translationOf(translation.blocks)}
        isPublished={
          work ? isPublishedStatus(work.publicationStatus) : undefined
        }
      />
    </StackReaderProvider>
  );
};
