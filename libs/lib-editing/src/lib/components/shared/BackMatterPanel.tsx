'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import { TranslationEditorContent } from '../editor';
import { TranslationRenderer } from './types';
import { BibliographyEntries, GlossaryTermInstances } from '@data-access';
import { ReactElement } from 'react';
import { useNavigation } from './NavigationProvider';
import { GlossaryTermList } from './glossary';
import { BibliographyList } from './bibliography';

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
    >
      <TabsList className="sticky top-0 py-8 mx-auto z-10 w-full rounded-none bg-muted">
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
      <div className="px-8 max-w-readable w-full mx-auto ">
        {endnotes.length > 0 && (
          <TabsContent value="endnotes">
            {renderTranslation({
              content: endnotes,
              className: 'block pe-8',
              name: 'endnotes',
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
              className: 'block pe-8',
              name: 'abbreviations',
            })}
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
};
