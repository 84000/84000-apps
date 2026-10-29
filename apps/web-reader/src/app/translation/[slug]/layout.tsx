import { ReaderLayout } from '@eightyfourthousand/lib-editing';
import { isPublishedStatus } from '@eightyfourthousand/data-access';
import {
  createBuildGraphQLClient,
  getTranslationMetadataByUuid,
} from '@eightyfourthousand/client-graphql/ssr';
import { isUuid } from '@eightyfourthousand/lib-utils';
import { notFound } from 'next/navigation';
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

  // Toh slugs are redirected to the uuid by the proxy; anything else is unknown.
  if (!isUuid(slug)) {
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
