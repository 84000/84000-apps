import { ReaderLayout } from '@eightyfourthousand/lib-editing';
import { isPublishedStatus } from '@eightyfourthousand/data-access';
import {
  createAnonServerClient,
  lookupEntityWithClient,
} from '@eightyfourthousand/data-access/ssr';
import {
  createBuildGraphQLClient,
  getTranslationMetadataByUuid,
} from '@eightyfourthousand/client-graphql/ssr';
import { isUuid } from '@eightyfourthousand/lib-utils';
import { notFound, redirect } from 'next/navigation';
import { ReactNode, Suspense } from 'react';

const Layout = async ({
  left,
  main,
  right,
  params,
}: {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  // Toh slugs (`/translation/toh1`) resolve to the work's uuid.
  if (!isUuid(slug)) {
    const { path } = await lookupEntityWithClient({
      client: createAnonServerClient(),
      type: 'translation',
      entity: slug,
      prefix: '/translation',
    });

    if (path) {
      redirect(path);
    }

    notFound();
  }

  // Unpublished works are hidden on the server, not left to the client's role
  // check: a studio session on the same localhost would otherwise reveal them.
  const work = await getTranslationMetadataByUuid({
    client: createBuildGraphQLClient(),
    uuid: slug,
  });

  if (!work || !isPublishedStatus(work.publicationStatus)) {
    notFound();
  }

  return (
    // ReaderLayout's NavigationProvider reads search params, which needs a
    // Suspense boundary.
    <Suspense>
      <ReaderLayout left={left} main={main} right={right} params={params} />
    </Suspense>
  );
};

export default Layout;
