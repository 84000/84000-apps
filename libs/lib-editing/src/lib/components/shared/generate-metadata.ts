import {
  createServerGraphQLClient,
  getTranslationMetadataByUuid,
} from '@eightyfourthousand/client-graphql/ssr';
import { isUuid, parseToh } from '@eightyfourthousand/lib-utils';
import { Metadata } from 'next';
import { cache } from 'react';
import {
  DEFAULT_READER_DESCRIPTION,
  DEFAULT_READER_TITLE,
  getTranslationPath,
  getWorkDescription,
  SITE_NAME,
} from './seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Skip metadata generation for non-UUID paths (e.g., icon requests)
  if (!isUuid(slug)) {
    return {
      title: DEFAULT_READER_TITLE,
      description: DEFAULT_READER_DESCRIPTION,
    };
  }

  const client = await createServerGraphQLClient();
  const work = await cache(getTranslationMetadataByUuid)({
    client,
    uuid: slug,
  });

  if (!work) {
    return {
      title: DEFAULT_READER_TITLE,
      description: DEFAULT_READER_DESCRIPTION,
    };
  }

  const tohDisplay = work.toh.map(parseToh).join(', ');
  const description = getWorkDescription(work);
  const canonicalPath = getTranslationPath(work.uuid);

  return {
    title: work.title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: work.title,
      description,
      url: canonicalPath,
      siteName: SITE_NAME,
      type: 'article',
      images: [
        {
          url: `${canonicalPath}/opengraph-image`,
          alt: `${work.title}${tohDisplay ? ` (${tohDisplay})` : ''}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: work.title,
      description,
      images: [`${canonicalPath}/opengraph-image`],
    },
    robots: {
      index: !work.restriction,
      follow: true,
    },
  };
}
