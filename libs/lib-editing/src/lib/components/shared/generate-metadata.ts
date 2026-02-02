import {
  createBrowserClient,
  getTranslationMetadataByUuid,
} from '@data-access';
import { isUuid, parseToh } from '@lib-utils';
import { Metadata } from 'next';
import { cache } from 'react';

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

  const tohDisplay = work.toh.map(parseToh).join(', ');

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
