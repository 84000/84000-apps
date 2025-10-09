'use client';

import { TranslationReader } from '../TranslationReader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import { TranslationEditorContent } from '../../editor';

export const FrontMatterPanel = ({
  summary,
}: {
  summary: TranslationEditorContent;
}) => {
  return (
    <Tabs
      defaultValue="summary"
      className="px-8 pb-[var(--header-height)] max-w-6xl w-full mx-auto mb-[var(--header-height)]"
    >
      <TabsList className="sticky top-2 mx-auto z-10">
        <TabsTrigger value="toc">Navigation</TabsTrigger>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="imprint">Imprint</TabsTrigger>
      </TabsList>
      <TabsContent value="toc">Table of Contents coming soon...</TabsContent>
      <TabsContent value="summary">
        <TranslationReader content={summary} className="block" />
      </TabsContent>
      <TabsContent value="imprint">Imprint coming soon...</TabsContent>
    </Tabs>
  );
};
