import DataLoader from 'dataloader';
import {
  getGlossaryTermPassagesPages,
  type ContentSource,
  type DataClient,
  type GlossaryPassagesPage,
} from '@eightyfourthousand/data-access';

const EMPTY_PAGE: GlossaryPassagesPage = {
  items: [],
  nextCursor: null,
  hasMore: false,
};

/**
 * A glossary page resolves this field once per term, and it used to cost about
 * 76 requests each — 3,827 in three minutes against production, enough to
 * saturate the connection pool and return 500s. Batching collapses a page to
 * one call.
 *
 * The key carries the pagination arguments as well as the term, because two
 * terms asked for different pages cannot share a query. In practice a page asks
 * every term for the same slice, so they coalesce into a single batch; the
 * grouping below is what keeps this correct if they ever do not.
 */
type PassagesKey = {
  uuid: string;
  first?: number;
  after?: string;
};

const cacheKey = ({ uuid, first, after }: PassagesKey) =>
  `${uuid} ${first ?? ''} ${after ?? ''}`;

const pageKey = ({ first, after }: PassagesKey) => `${first ?? ''} ${after ?? ''}`;

export function createGlossaryPassagesLoader(
  supabase: DataClient,
  source: ContentSource,
) {
  return new DataLoader<PassagesKey, GlossaryPassagesPage, string>(
    async (keys) => {
      // One query per distinct (first, after); normally exactly one.
      const groups = new Map<string, PassagesKey[]>();
      for (const key of keys) {
        const group = groups.get(pageKey(key));
        if (group) {
          group.push(key);
        } else {
          groups.set(pageKey(key), [key]);
        }
      }

      const pagesByKey = new Map<string, GlossaryPassagesPage>();

      await Promise.all(
        Array.from(groups.values(), async (group) => {
          const { first, after } = group[0];
          const pages = await getGlossaryTermPassagesPages({
            client: supabase,
            uuids: group.map((key) => key.uuid),
            first,
            after,
            source,
          });

          for (const key of group) {
            pagesByKey.set(cacheKey(key), pages.get(key.uuid) ?? EMPTY_PAGE);
          }
        }),
      );

      // A term with no citing passages is absent from the map rather than an
      // error, so it resolves to an empty page instead of rejecting the field.
      return keys.map((key) => pagesByKey.get(cacheKey(key)) ?? EMPTY_PAGE);
    },
    { cacheKeyFn: cacheKey },
  );
}
