import { ReaderLayout, TranslationSkeleton } from '@lib-editing';
import { cache, ReactNode, Suspense } from 'react';
import { Metadata } from 'next';
import {
  createBrowserClient,
  getTranslationMetadataByUuid,
} from '@data-access';
import { isUuid } from '@lib-utils';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Skip metadata generation for non-UUID paths (e.g., icon requests)
  if (!isUuid(slug)) {
    return { title: '84000 Translation Reader' };
  }

  const client = createBrowserClient();
  const work = await cache(getTranslationMetadataByUuid)({
    client,
    uuid: slug,
  });

  if (!work) {
    return { title: '84000 Translation Reader' };
  }

  const tohDisplay = work.toh.map((t) => t).join(', ');

  return {
    title: `${work.title} | 84000`,
    description:
      work.description || `${work.title} - ${tohDisplay} - ${work.section}`,
    openGraph: {
      title: work.title,
      description:
        work.description || `Buddhist translation from the ${work.section}`,
      type: 'article',
    },
  };
}

const Layout = (props: {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  params: Promise<{ slug: string }>;
}) => {
  return (
    <Suspense fallback={<TranslationSkeleton />}>
      <ReaderLayout {...props} />
    </Suspense>
  );
};

export default Layout;
