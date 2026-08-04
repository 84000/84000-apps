'use client';

import {
  H2,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@eightyfourthousand/design-system';
import { Work } from '@eightyfourthousand/data-access';
import { useCallback, useState } from 'react';
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

  // The URL seeds the tab and records it, but does not drive it. Reading `activeTab`
  // straight from useSearchParams would make the switch depend on a replaceState being
  // reflected back through the router — true in Next today, but a fragile thing for a
  // click to rely on. Local state keeps the interaction self-contained.
  const initialTab: LandingTab =
    searchParams.get(TAB_PARAM) === 'diagnostics'
      ? 'diagnostics'
      : 'translations';

  const [activeTab, setActiveTab] = useState<LandingTab>(initialTab);

  // Radix unmounts inactive tab content by default, so without forceMount every switch
  // tears down one DataTable over ~1000 works and builds the other from scratch — and
  // remounting Diagnostics refires its status fetch. That is the whole cost of switching
  // tabs, and it is entirely avoidable: once a table exists, hiding it is free.
  //
  // Mounted lazily rather than both up front, so opening the page still only pays for the
  // table being shown. A tab joins this set the first time it is opened and stays.
  const [mounted, setMounted] = useState<Set<LandingTab>>(
    () => new Set([initialTab]),
  );

  const onValueChange = useCallback(
    (value: string) => {
      const tab: LandingTab =
        value === 'diagnostics' ? 'diagnostics' : 'translations';
      setActiveTab(tab);
      setMounted((current) =>
        current.has(tab) ? current : new Set(current).add(tab),
      );

      const params = new URLSearchParams(window.location.search);
      if (tab === 'diagnostics') {
        params.set(TAB_PARAM, tab);
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

  return (
    <Tabs
      value={activeTab}
      onValueChange={onValueChange}
      className="w-full gap-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4 pt-8 pb-4">
        <H2 className="text-primary m-0 p-0">{'Translation Editor'}</H2>
        <TabsList className="bg-surface">
          <TabsTrigger className="bg-surface" value="translations">
            Translations
          </TabsTrigger>
          <TabsTrigger className="bg-surface" value="diagnostics">
            Diagnostics
          </TabsTrigger>
        </TabsList>
      </div>
      {mounted.has('translations') && (
        <TabsContent
          value="translations"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <TranslationsTable works={works} />
        </TabsContent>
      )}
      {mounted.has('diagnostics') && (
        <TabsContent
          value="diagnostics"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <DiagnosticsTable works={works} />
        </TabsContent>
      )}
    </Tabs>
  );
};
