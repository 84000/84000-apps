'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@eightyfourthousand/design-system';
import { TranslationEditorContent } from '../editor';
import { TranslationRenderer } from './types';
import { BibliographyEntries } from '@eightyfourthousand/data-access';
import type { GlossaryTermsPage } from '@eightyfourthousand/client-graphql';
import { ReactElement, useRef } from 'react';
import { useNavigation } from './NavigationProvider';
import { GlossaryTermList, GlossaryPaginationProvider } from './glossary';
import { BibliographyList } from './bibliography';
import { cn, useIsMobile } from '@eightyfourthousand/lib-utils';
import { useScrollPositionRestore } from './hooks/useScrollPositionRestore';

export const BackMatterPanel = ({
  workUuid,
  endnotes,
  glossary,
  bibliography,
  abbreviations,
  renderTranslation,
}: {
  workUuid: string;
  endnotes: TranslationEditorContent;
  glossary: GlossaryTermsPage;
  bibliography: BibliographyEntries;
  abbreviations: TranslationEditorContent;
  renderTranslation: (
    params: TranslationRenderer,
  ) => ReactElement<TranslationRenderer>;
}) => {
  const { panels, updatePanel } = useNavigation();
  const isMobile = useIsMobile();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useScrollPositionRestore(
    'right',
    scrollContainerRef,
    panels.right.tab,
    !!panels.right.hash,
  );

  const hasGlossary =
    glossary.terms.length > 0 || glossary.hasMoreAfter;

  return (
    <Tabs
      value={panels.right.tab || 'endnotes'}
      onValueChange={(tabName) => {
        const tab = tabName as
          | 'endnotes'
          | 'glossary'
          | 'bibliography'
          | 'abbreviations';
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
          {endnotes.length > 0 && (
            <TabsTrigger value="endnotes">Notes</TabsTrigger>
          )}
          {hasGlossary && (
            <TabsTrigger value="glossary">Glossary</TabsTrigger>
          )}
          {bibliography.length > 0 && (
            <TabsTrigger value="bibliography">Biblio</TabsTrigger>
          )}
          {abbreviations.length > 0 && (
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
            {endnotes.length > 0 && (
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
                >
                  <GlossaryTermList />
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
            {abbreviations.length > 0 && (
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
                })}
              </TabsContent>
            )}
          </div>
        </div>
      </div>
    </Tabs>
  );
};
