'use client';

import { useEffect, useState } from 'react';
import { H3 } from '@eightyfourthousand/design-system';
import type { TohokuCatalogEntry } from '@eightyfourthousand/data-access';
import {
  createGraphQLClient,
  getTranslationMetadataByToh,
} from '@eightyfourthousand/client-graphql';
import {
  NavigationProvider,
  StackTab,
  StackWorkProvider,
  useStackTohVisibility,
  useStackWork,
} from '@eightyfourthousand/lib-editing/stack';

/**
 * The two stacked tabs side by side, over one work.
 *
 * What `web-main` draws in its main and right panels, minus the panels — those
 * routes need an authenticated session, which the ledger records as a human
 * step (`2026-08-04-local-verification-without-ui-login`). This is where the
 * shared work, the per-tab views and the cross-tab undo can be exercised
 * against real data.
 */
const Body = ({ tohList }: { tohList: TohokuCatalogEntry[] }) => {
  useStackTohVisibility({ tohList });
  const stack = useStackWork();

  // Debug handle, as `/stack/[toh]` exposes `__stackController`.
  useEffect(() => {
    (window as unknown as Record<string, unknown>)['__stackWork'] = stack;
  }, [stack]);

  return (
    <div className="flex h-[calc(100dvh-5rem)] w-full gap-4">
      <div className="h-full flex-1 border-r" data-testid="tab-translation">
        <StackTab tab="translation" className="h-full" />
      </div>
      <div className="h-full w-2/5" data-testid="tab-endnotes">
        <StackTab tab="endnotes" className="h-full" />
      </div>
    </div>
  );
};

export const StackTabsPage = ({ toh }: { toh: string }) => {
  const [work, setWork] = useState<{
    uuid: string;
    toh: TohokuCatalogEntry[];
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = createGraphQLClient();
      const found = await getTranslationMetadataByToh({ client, toh });
      if (cancelled) return;
      if (!found) {
        setFailed(true);
        return;
      }
      setWork({ uuid: found.uuid, toh: found.toh ?? [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [toh]);

  if (failed) {
    return <H3 className="px-12 py-2">No work found for {toh}.</H3>;
  }
  if (!work) {
    return <H3 className="px-12 py-2">Loading...</H3>;
  }

  return (
    <NavigationProvider uuid={work.uuid} initialToh={toh as TohokuCatalogEntry}>
      <StackWorkProvider workUuid={work.uuid}>
        <Body
          tohList={work.toh.length ? work.toh : [toh as TohokuCatalogEntry]}
        />
      </StackWorkProvider>
    </NavigationProvider>
  );
};
