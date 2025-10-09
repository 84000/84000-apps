'use client';

import { TranslationReader } from '../TranslationReader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import { TranslationEditorContent } from '../../editor';
import { BibliographyList, GlossaryTermList } from '../../page';
import { BibliographyEntries, GlossaryTermInstances } from '@data-access';

export const BackMatterPanel = ({
  endnotes,
  glossary,
  bibliography,
  abbreviations,
}: {
  endnotes: TranslationEditorContent;
  glossary: GlossaryTermInstances;
  bibliography: BibliographyEntries;
  abbreviations: TranslationEditorContent;
}) => {
  return (
    <Tabs
      defaultValue="endnotes"
      className="px-8 pb-[var(--header-height)] max-w-6xl w-full mx-auto mb-[var(--header-height)]"
    >
      <TabsList className="sticky top-2 mx-auto z-10">
        <TabsTrigger value="endnotes">Notes</TabsTrigger>
        <TabsTrigger value="glossary">Glossary</TabsTrigger>
        <TabsTrigger value="bibliography">Biblio</TabsTrigger>
        <TabsTrigger value="abbreviations">Abbreviations</TabsTrigger>
      </TabsList>
      <TabsContent value="endnotes">
        <TranslationReader content={endnotes} />
      </TabsContent>
      <TabsContent value="glossary">
        <GlossaryTermList content={glossary} />
      </TabsContent>
      <TabsContent value="bibliography">
        <BibliographyList content={bibliography} />
      </TabsContent>
      <TabsContent value="abbreviations">
        <TranslationReader content={abbreviations} />
      </TabsContent>
    </Tabs>
  );
};
