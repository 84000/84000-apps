import {
  createServerGraphQLClient,
  getTranslationMetadataByUuid,
} from '@eightyfourthousand/client-graphql/ssr';
import { isUuid, parseToh } from '@eightyfourthousand/lib-utils';
import { cache } from 'react';
import {
  getTranslationUrl,
  getWorkDescription,
  SITE_NAME,
} from './seo';

export const TranslationStructuredData = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  if (!isUuid(slug)) {
    return null;
  }

  const client = await createServerGraphQLClient();
  const work = await cache(getTranslationMetadataByUuid)({
    client,
    uuid: slug,
  });

  if (!work) {
    return null;
  }

  const url = getTranslationUrl(work.uuid);
  const toh = work.toh.map(parseToh).filter(Boolean);
  const description = getWorkDescription(work);

  const graph = [
    {
      '@type': 'Book',
      '@id': `${url}#work`,
      url,
      name: work.title,
      description,
      inLanguage: ['en', 'bo'],
      isPartOf: work.section
        ? {
            '@type': 'CreativeWorkSeries',
            name: work.section,
          }
        : undefined,
      identifier: [work.uuid, ...toh],
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: 'https://84000.co',
      },
      datePublished: work.publicationDate?.toISOString().split('T')[0],
      version: work.publicationVersion,
      numberOfPages: work.pages || undefined,
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Translations',
          item: 'https://84000.co/translation',
        },
        ...(work.section
          ? [
              {
                '@type': 'ListItem',
                position: 2,
                name: work.section,
              },
            ]
          : []),
        {
          '@type': 'ListItem',
          position: work.section ? 3 : 2,
          name: work.title,
          item: url,
        },
      ],
    },
  ];

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': graph,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
};
