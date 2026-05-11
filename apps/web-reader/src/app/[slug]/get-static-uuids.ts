import {
  createBuildGraphQLClient,
  getTranslationUuids,
} from '@eightyfourthousand/client-graphql/ssr';
import { unstable_cache } from 'next/cache';

const getStaticUuidLimit = () => {
  const rawLimit = process.env.STATIC_UUID_LIMIT;

  if (!rawLimit) {
    return undefined;
  }

  const limit = Number.parseInt(rawLimit, 10);
  return Number.isFinite(limit) && limit > 0 ? limit : undefined;
};

const fetchStaticUuids = async (): Promise<string[]> => {
  console.log('Fetching static UUIDs...');
  const client = createBuildGraphQLClient();
  return getTranslationUuids({ client, limit: getStaticUuidLimit() });
};

// Cache for 1 hour, or until revalidated
export const getStaticUuids = unstable_cache(
  fetchStaticUuids,
  ['static-uuids'],
  {
    revalidate: 3600,
  },
);
