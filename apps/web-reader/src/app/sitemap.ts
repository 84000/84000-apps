import {
  createBuildGraphQLClient,
  getTranslationUuids,
} from '@eightyfourthousand/client-graphql/ssr';
import type { MetadataRoute } from 'next';

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://84000.co'
).replace(/\/$/, '');

const getSitemapLimit = () => {
  const rawLimit = process.env.STATIC_UUID_LIMIT;

  if (!rawLimit) {
    return undefined;
  }

  const limit = Number.parseInt(rawLimit, 10);
  return Number.isFinite(limit) && limit > 0 ? limit : undefined;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const client = createBuildGraphQLClient();
  const uuids = await getTranslationUuids({
    client,
    limit: getSitemapLimit(),
  });

  return uuids.map((uuid) => ({
    url: `${siteUrl}/${uuid}`,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));
}
