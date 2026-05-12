import {
  createBuildGraphQLClient,
  getTranslationUuids,
} from '@eightyfourthousand/client-graphql/ssr';
import type { MetadataRoute } from 'next';

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://84000.co'
).replace(/\/$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const client = createBuildGraphQLClient();
  const uuids = await getTranslationUuids({
    client,
  });

  return uuids.map((uuid) => ({
    url: `${siteUrl}/${uuid}`,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));
}
