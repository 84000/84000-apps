'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import { TranslationEditorContent } from '../editor';
import { BibliographyList, GlossaryTermList, TranslationRenderer } from '.';
import { BibliographyEntries, GlossaryTermInstances } from '@data-access';
import { ReactElement } from 'react';

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
  return (
    <Tabs
      data-position="sidebar"
      defaultValue="endnotes"
      className="px-8 pb-[var(--header-height)] max-w-6xl w-full mx-auto mb-[var(--header-height)]"
    >
      <TabsList className="sticky top-3 mx-auto z-10">
        <TabsTrigger value="endnotes">Notes</TabsTrigger>
        <TabsTrigger value="glossary">Glossary</TabsTrigger>
        <TabsTrigger value="bibliography">Biblio</TabsTrigger>
        <TabsTrigger value="abbreviations">Abbreviations</TabsTrigger>
      </TabsList>
      <TabsContent value="endnotes">
        {renderTranslation({
          content: endnotes,
          className: 'block',
          name: 'endnotes',
        })}
      </TabsContent>
      <TabsContent value="glossary">
        <GlossaryTermList content={glossary} />
      </TabsContent>
      <TabsContent value="bibliography">
        <BibliographyList content={bibliography} />
      </TabsContent>
      <TabsContent value="abbreviations">
        {renderTranslation({
          content: abbreviations,
          className: 'block',
          name: 'abbreviations',
        })}
      </TabsContent>
    </Tabs>
  );
};
