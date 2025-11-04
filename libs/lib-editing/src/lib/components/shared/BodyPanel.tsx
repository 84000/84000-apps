'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import { TranslationEditorContent } from '../editor';
import { Folio, Title } from '@data-access';
import { TitlesRenderer, TranslationRenderer } from './types';
import { ReactElement } from 'react';
import { useNavigation } from './NavigationProvider';
import { SourceReader } from './SourceReader';

export const BodyPanel = ({
  titles,
  body,
  folios = [],
  renderTitles,
  renderTranslation,
}: {
  titles: Title[];
  body: TranslationEditorContent;
  folios?: Folio[];
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
      className="px-8 pb-[var(--header-height)] w-full mb-[var(--header-height)]"
    >
      <TabsList className="sticky top-3 mx-auto -mt-25 z-10">
        <TabsTrigger value="translation">Translation</TabsTrigger>
        <TabsTrigger value="source">Source</TabsTrigger>
        <TabsTrigger value="compare">Compare</TabsTrigger>
      </TabsList>
      <TabsContent value="translation">
        <div className="w-full max-w-5xl mx-auto">
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
      <TabsContent value="source">
        <SourceReader />
      </TabsContent>
      <TabsContent value="compare">
        Language comparison coming soon...
      </TabsContent>
    </Tabs>
  );
};
