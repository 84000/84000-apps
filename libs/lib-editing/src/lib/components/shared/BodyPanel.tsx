'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import { TranslationEditorContent } from '../editor';
import { Title } from '@data-access';
import { TitlesRenderer, TranslationRenderer } from './types';
import { ReactElement } from 'react';
import { useNavigation } from './NavigationProvider';

export const BodyPanel = ({
  titles,
  body,
  renderTitles,
  renderTranslation,
}: {
  titles: Title[];
  body: TranslationEditorContent;
  renderTitles: (params: TitlesRenderer) => ReactElement<TitlesRenderer>;
  renderTranslation: (
    params: TranslationRenderer,
  ) => ReactElement<TranslationRenderer>;
}) => {
  const { panels, imprint, updatePanel } = useNavigation();

  return (
    <Tabs
      value={panels.main.tab || 'translation'}
      onValueChange={(tabName) => {
        const tab = tabName as 'translation' | 'source' | 'compare';
        updatePanel({ name: 'main', state: { open: true, tab } });
      }}
      data-position="main"
      defaultValue="translation"
      className="px-8 pb-[var(--header-height)] max-w-5xl w-full mx-auto mb-[var(--header-height)]"
    >
      <TabsList className="sticky top-3 mx-auto -mt-25 z-10">
        <TabsTrigger value="translation">Translation</TabsTrigger>
        <TabsTrigger value="source">Source</TabsTrigger>
        <TabsTrigger value="compare">Compare</TabsTrigger>
      </TabsList>
      <TabsContent value="translation">
        <div className="w-full">
          <div className="ms-12 mt-12 mb-8">
            {renderTitles({ titles, imprint })}
          </div>
          {renderTranslation({
            content: body,
            className: 'block',
            name: 'translation',
          })}
        </div>
      </TabsContent>
      <TabsContent value="source">Source text coming soon...</TabsContent>
      <TabsContent value="compare">
        Language comparison coming soon...
      </TabsContent>
    </Tabs>
  );
};
