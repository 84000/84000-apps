import { createBuildGraphQLClient } from '@eightyfourthousand/client-graphql/ssr';
import { isUuid } from '@eightyfourthousand/lib-utils';
import type { ComponentProps } from 'react';
import { StackReaderProvider } from '../stack/StackReaderProvider';
import { loadStackReaderSeed } from '../stack/stack-reader-seed';
import { isReaderPublished } from './reader-publication';
import { ReaderLayout } from './ReaderLayout';

/**
 * `ReaderLayout` over one work's passage stacks, read on the server.
 *
 * The main and right panels' stack pages (`StackReaderBodyPage`,
 * `StackReaderBackMatterPage`) draw from it, so they share a spine as the
 * editor's tabs do, and the server draws each tab's first window.
 *
 * A work that is not published is read for no one: no seed and no stacks, so
 * neither the page nor the browser carries its content.
 */
export const StackReaderLayout = async ({
  params,
  ...layout
}: ComponentProps<typeof ReaderLayout>) => {
  const { slug } = await params;

  // The pages answer an unknown slug; there is no work to read.
  if (!isUuid(slug)) {
    return <ReaderLayout params={params} {...layout} />;
  }

  const client = createBuildGraphQLClient();
  if (!(await isReaderPublished({ client, uuid: slug }))) {
    return <ReaderLayout params={params} {...layout} />;
  }

  const seed = await loadStackReaderSeed({ client, workUuid: slug });

  return (
    <StackReaderProvider workUuid={slug} seed={seed}>
      <ReaderLayout params={params} {...layout} />
    </StackReaderProvider>
  );
};
