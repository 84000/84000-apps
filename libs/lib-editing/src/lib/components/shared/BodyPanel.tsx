'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import { TranslationEditorContent } from '../editor';
import { Title } from '@data-access';
import { TitlesRenderer, TranslationRenderer } from './types';
import { ReactElement } from 'react';

export const BodyPanel = ({
  titles,
  body,
  renderHeader,
  renderTitles,
  renderTranslation,
}: {
  titles: Title[];
  body: TranslationEditorContent;
  renderHeader?: () => ReactElement;
  renderTitles: (params: TitlesRenderer) => ReactElement<TitlesRenderer>;
  renderTranslation: (
    params: TranslationRenderer,
  ) => ReactElement<TranslationRenderer>;
}) => {
  return (
    <Tabs
      defaultValue="translation"
      className="px-8 pb-[var(--header-height)] max-w-6xl w-full mx-auto mb-[var(--header-height)]"
    >
      <TabsList className="sticky top-3 mx-auto -mt-13 z-10">
        <TabsTrigger value="translation">Translation</TabsTrigger>
        <TabsTrigger value="source">Source</TabsTrigger>
        <TabsTrigger value="compare">Compare</TabsTrigger>
      </TabsList>
      <TabsContent value="translation">
        <div className="w-full">
          {renderHeader?.()}
          <div className="ms-12 mt-12 mb-8">{renderTitles({ titles })}</div>
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
