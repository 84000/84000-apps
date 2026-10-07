'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@eightyfourthousand/design-system';
import { TranslationEditorContent } from '../editor';
import { TranslationRenderer } from './types';
import { BibliographyEntries } from '@eightyfourthousand/data-access';
import type { GlossaryTermsPage } from '@eightyfourthousand/client-graphql';
import { ReactElement, useRef } from 'react';
import { useNavigation } from './NavigationProvider';
import { GlossaryTermList, GlossaryPaginationProvider } from './glossary';
import { BibliographyList } from './bibliography';
import { cn, useIsMobile } from '@eightyfourthousand/lib-utils';
import {
  recordPassageAnchor,
  recordScrollPosition,
  usePassageAnchorRestore,
  useScrollPositionRestore,
} from './hooks/useScrollPositionRestore';

export const BackMatterPanel = ({
  workUuid,
  endnotes,
  glossary,
  bibliography,
  abbreviations,
  endnotesHasMore,
  abbreviationsHasMore,
  hasEndnotes = endnotes.length > 0,
  hasAbbreviations = abbreviations.length > 0,
  isEditor = false,
  withAttestations = false,
  renderTranslation,
}: {
  workUuid: string;
  endnotes: TranslationEditorContent;
  glossary: GlossaryTermsPage;
  bibliography: BibliographyEntries;
  abbreviations: TranslationEditorContent;
  endnotesHasMore?: boolean;
  abbreviationsHasMore?: boolean;
  /** Whether to show Notes, when that is known without its content. */
  hasEndnotes?: boolean;
  /** Whether to show Abbr, when that is known without its content. */
  hasAbbreviations?: boolean;
  isEditor?: boolean;
  withAttestations?: boolean;
  renderTranslation: (
    params: TranslationRenderer,
  ) => ReactElement<TranslationRenderer>;
}) => {
  const { panels, updatePanel } = useNavigation();
  const isMobile = useIsMobile();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTab = panels.right.tab || 'endnotes';
  // Notes and Abbreviations share this scroller with the other tabs, and are
  // realigned by the passage at the top, as the main panel's are.
  const passageAnchorRef = usePassageAnchorRestore(
    scrollContainerRef,
    activeTab,
    'right',
    !!panels.right.hash,
  );
  useScrollPositionRestore(
    'right',
    scrollContainerRef,
    activeTab,
    !!panels.right.hash,
    passageAnchorRef,
  );

  const hasGlossary = glossary.terms.length > 0 || glossary.hasMoreAfter;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(tabName) => {
        const tab = tabName as
          | 'endnotes'
          | 'glossary'
          | 'bibliography'
          | 'abbreviations';
        // Recorded before the switch, which can clamp the scroll position.
        if (scrollContainerRef.current) {
          recordScrollPosition('right', activeTab, scrollContainerRef.current);
          recordPassageAnchor(
            passageAnchorRef.current,
            activeTab,
            scrollContainerRef.current,
          );
        }
        updatePanel({ name: 'right', state: { open: true, tab } });
      }}
      defaultValue="endnotes"
      className="w-full gap-0 @container/sidebar h-full flex flex-col"
    >
      <div className="sticky top-0 pt-1 pb-2 z-10 w-full rounded-t bg-background overflow-x-auto text-center">
        <TabsList
          className={cn(
            'w-fit px-6 inline-flex mx-auto rounded-none',
            isMobile && 'ps-12',
          )}
        >
          {hasEndnotes && (
            <TabsTrigger value="endnotes">Notes</TabsTrigger>
          )}
          {hasGlossary && <TabsTrigger value="glossary">Glossary</TabsTrigger>}
          {bibliography.length > 0 && (
            <TabsTrigger value="bibliography">Biblio</TabsTrigger>
          )}
          {hasAbbreviations && (
            <TabsTrigger value="abbreviations">Abbr</TabsTrigger>
          )}
        </TabsList>
      </div>
      <div className="flex-1 min-h-0">
        <div
          ref={scrollContainerRef}
          className="overflow-auto h-full bg-surface"
          data-panel="right"
        >
          <div className="rounded ps-10 pe-4 max-w-readable mx-auto">
            {hasEndnotes && (
              <TabsContent
                value="endnotes"
                forceMount
                className="data-[state=inactive]:hidden"
              >
                {renderTranslation({
                  content: endnotes,
                  className: 'block',
                  name: 'endnotes',
                  panel: 'right',
                  hasMoreAfter: endnotesHasMore,
                })}
              </TabsContent>
            )}
            {hasGlossary && (
              <TabsContent
                value="glossary"
                forceMount
                className="pb-8 data-[state=inactive]:hidden"
              >
                <GlossaryPaginationProvider
                  workUuid={workUuid}
                  initialPage={glossary}
                  withAttestations={withAttestations}
                >
                  <GlossaryTermList isEditor={isEditor} />
                </GlossaryPaginationProvider>
              </TabsContent>
            )}
            {bibliography.length > 0 && (
              <TabsContent
                value="bibliography"
                forceMount
                className="pb-8 data-[state=inactive]:hidden"
              >
                <BibliographyList content={bibliography} />
              </TabsContent>
            )}
            {hasAbbreviations && (
              <TabsContent
                value="abbreviations"
                forceMount
                className="data-[state=inactive]:hidden"
              >
                {renderTranslation({
                  content: abbreviations,
                  className: 'block',
                  name: 'abbreviations',
                  panel: 'right',
                  hasMoreAfter: abbreviationsHasMore,
                })}
              </TabsContent>
            )}
          </div>
        </div>
      </div>
    </Tabs>
  );
};
