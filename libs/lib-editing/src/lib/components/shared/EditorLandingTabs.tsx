'use client';

import {
  H2,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@eightyfourthousand/design-system';
import { Work } from '@eightyfourthousand/data-access';
import { useCallback, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { TranslationsTable } from './TranslationTable';
import { DiagnosticsTable } from './DiagnosticsTable';

type LandingTab = 'translations' | 'diagnostics';

const TAB_PARAM = 'view';

/**
 * The editor landing page: the work list, and the publish diagnostics for the corpus.
 *
 * Replaces the former "Translation Editor" heading with tabs. Diagnostics is a peer of the
 * work list rather than a page of its own because it answers a question about the same
 * set of works — which of them can be published — and cleanup is prioritized by looking at
 * the corpus, not one work at a time.
 *
 * The active tab lives in the URL so a link can point at the diagnostics view directly.
 * Both tabs mount lazily: the diagnostics table fetches cached statuses on mount, and the
 * work list should not pay for that.
 */
export const EditorLandingTabs = ({ works }: { works: Work[] }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab: LandingTab =
    searchParams.get(TAB_PARAM) === 'diagnostics'
      ? 'diagnostics'
      : 'translations';

  const onValueChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(window.location.search);
      if (value === 'diagnostics') {
        params.set(TAB_PARAM, value);
      } else {
        params.delete(TAB_PARAM);
      }
      const query = params.toString();
      // replaceState rather than router.replace: switching tabs is a client-side view
      // change and does not need a server round-trip.
      window.history.replaceState(
        null,
        '',
        query ? `${pathname}?${query}` : pathname,
      );
    },
    [pathname],
  );

  // The tables keep their own search/sort state in the URL, and remounting them on every
  // tab switch would discard it, so both stay mounted once rendered.
  const tables = useMemo(
    () => ({
      translations: <TranslationsTable works={works} />,
      diagnostics: <DiagnosticsTable works={works} />,
    }),
    [works],
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={onValueChange}
      className="w-full gap-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4 pt-8 pb-4">
        <H2 className="text-primary m-0 p-0">{'Translation Editor'}</H2>
        <TabsList>
          <TabsTrigger value="translations">Translations</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="translations">{tables.translations}</TabsContent>
      <TabsContent value="diagnostics">{tables.diagnostics}</TabsContent>
    </Tabs>
  );
};
