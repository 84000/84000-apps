import {
  createBuildGraphQLClient,
  getTranslationUuids,
} from '@client-graphql/ssr';
import { unstable_cache } from 'next/cache';

const fetchStaticUuids = async (): Promise<string[]> => {
  console.log('Fetching static UUIDs...');
  const client = createBuildGraphQLClient();
  return getTranslationUuids({ client });
};

// Cache for 1 hour, or until revalidated
export const getStaticUuids = unstable_cache(
  fetchStaticUuids,
  ['static-uuids'],
  {
    revalidate: 3600,
  },
);
