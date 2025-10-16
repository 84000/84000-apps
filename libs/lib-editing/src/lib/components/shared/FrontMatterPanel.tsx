'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import { TranslationEditorContent } from '../editor';
import { TranslationRenderer } from './types';
import { ReactElement } from 'react';
import { useNavigation } from './NavigationProvider';

export const FrontMatterPanel = ({
  summary,
  renderTranslation,
}: {
  summary: TranslationEditorContent;
  renderTranslation: (
    params: TranslationRenderer,
  ) => ReactElement<TranslationRenderer>;
}) => {
  const { panels, updatePanel } = useNavigation();

  return (
    <Tabs
      value={panels.left.tab || 'toc'}
      onValueChange={(tabName) => {
        const tab = tabName as 'toc' | 'summary' | 'imprint';
        updatePanel({ name: 'left', state: { open: true, tab } });
      }}
      data-position="sidebar"
      defaultValue="summary"
      className="px-8 pb-[var(--header-height)] max-w-6xl w-full mx-auto mb-[var(--header-height)]"
    >
      <TabsList className="sticky top-3 mx-auto z-10">
        <TabsTrigger value="toc">Navigation</TabsTrigger>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="imprint">Imprint</TabsTrigger>
      </TabsList>
      <TabsContent value="toc">Table of Contents coming soon...</TabsContent>
      <TabsContent value="summary">
        {renderTranslation({
          content: summary,
          className: 'block',
          name: 'summary',
        })}
      </TabsContent>
      <TabsContent value="imprint">Imprint coming soon...</TabsContent>
    </Tabs>
  );
};
