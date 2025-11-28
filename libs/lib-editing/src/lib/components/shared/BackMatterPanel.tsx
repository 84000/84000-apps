'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import { TranslationEditorContent } from '../editor';
import { TranslationRenderer } from './types';
import { BibliographyEntries, GlossaryTermInstances } from '@data-access';
import { ReactElement } from 'react';
import { useNavigation } from './NavigationProvider';
import { GlossaryTermList } from './glossary';
import { BibliographyList } from './bibliography';
import { cn, useIsMobile } from '@lib-utils';

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
      data-position="sidebar"
      defaultValue="endnotes"
      className="w-full"
    >
      <div className="sticky top-0 py-3 z-10 w-full rounded-none bg-muted overflow-x-auto text-center">
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
            <TabsTrigger value="abbreviations">Abbreviations</TabsTrigger>
          )}
        </TabsList>
      </div>
      <div className="px-12 max-w-readable w-full mx-auto ">
        {endnotes.length > 0 && (
          <TabsContent value="endnotes">
            {renderTranslation({
              content: endnotes,
              className: 'block pe-8',
              name: 'endnotes',
              panel: 'right',
            })}
          </TabsContent>
        )}
        {glossary.length > 0 && (
          <TabsContent value="glossary" className="pb-8">
            <GlossaryTermList content={glossary} />
          </TabsContent>
        )}
        {bibliography.length > 0 && (
          <TabsContent value="bibliography" className="pb-8">
            <BibliographyList content={bibliography} />
          </TabsContent>
        )}
        {abbreviations.length > 0 && (
          <TabsContent value="abbreviations">
            {renderTranslation({
              content: abbreviations,
              className: 'block',
              name: 'abbreviations',
              panel: 'right',
            })}
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
};
