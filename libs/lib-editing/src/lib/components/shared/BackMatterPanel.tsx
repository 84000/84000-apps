'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import { TranslationEditorContent } from '../editor';
import { TranslationRenderer } from './types';
import { BibliographyEntries, GlossaryTermInstances } from '@data-access';
import { ReactElement, useRef } from 'react';
import { useNavigation } from './NavigationProvider';
import { GlossaryTermList } from './glossary';
import { BibliographyList } from './bibliography';
import { cn, useIsMobile } from '@lib-utils';
import { useScrollPositionRestore } from './hooks/useScrollPositionRestore';

export const BackMatterPanel = ({
  endnotes,
  glossary,
  bibliography,
  abbreviations,
  renderTranslation,
}: {
  endnotes: TranslationEditorContent;
  glossary: GlossaryTermInstances;
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
      className="w-full gap-0 @container/sidebar"
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
          {glossary.length > 0 && (
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
      <div className="px-2">
        <div ref={scrollContainerRef} className="overflow-auto md:h-[calc(100vh-8.5rem)] h-[calc(100vh-4rem)] rounded bg-surface">
          <div className="rounded ps-10 pe-4 max-w-readable mx-auto">
            {endnotes.length > 0 && (
              <TabsContent value="endnotes" forceMount className="data-[state=inactive]:hidden">
                {renderTranslation({
                  content: endnotes,
                  className: 'block',
                  name: 'endnotes',
                  panel: 'right',
                })}
              </TabsContent>
            )}
            {glossary.length > 0 && (
              <TabsContent value="glossary" forceMount className="pb-8 data-[state=inactive]:hidden">
                <GlossaryTermList content={glossary} />
              </TabsContent>
            )}
            {bibliography.length > 0 && (
              <TabsContent value="bibliography" forceMount className="pb-8 data-[state=inactive]:hidden">
                <BibliographyList content={bibliography} />
              </TabsContent>
            )}
            {abbreviations.length > 0 && (
              <TabsContent value="abbreviations" forceMount className="data-[state=inactive]:hidden">
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
