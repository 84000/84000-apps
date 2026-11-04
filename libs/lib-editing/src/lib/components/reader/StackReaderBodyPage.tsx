import {
  BODY_MATTER_FILTER,
  createBuildGraphQLClient,
  getTranslationBlocks,
  getTranslationTitles,
} from '@eightyfourthousand/client-graphql/ssr';
import type { TranslationEditorContent } from '@eightyfourthousand/data-access';
import { isUuid } from '@eightyfourthousand/lib-utils';
import { notFound } from 'next/navigation';
import { isReaderPublished } from './reader-publication';
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
 * The reader's main panel drawn from the stacks of the `StackReaderLayout`
 * above it, their first rows rendered on the server. `ReaderBodyPage`'s
 * counterpart: same route, same tabs.
 *
 * A work that is not published shows its titles and the unpublished state
 * alone, for every visitor: none of its passages are read.
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
  // Null for a work that is not published.
  const readBody = async () => {
    if (!(await isReaderPublished({ client, uuid: slug }))) return null;
    const { blocks } = await getTranslationBlocks({
      client,
      uuid: slug,
      type: BODY_MATTER_FILTER,
      maxPassages: ALIGNMENT_WINDOW,
    });
    return translationOf(blocks);
  };
  const [titles, body] = await Promise.all([
    getTranslationTitles({ client, uuid: slug }),
    readBody(),
  ]);

  return (
    <StackReaderBodyPanel
      titles={titles}
      body={body ?? []}
      isPublished={body !== null}
    />
  );
};
