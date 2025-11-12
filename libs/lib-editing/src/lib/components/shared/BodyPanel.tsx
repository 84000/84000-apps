'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import {
  TranslationEditorContent,
  TranslationEditorContentItem,
} from '../editor';
import { COMPARE_MODE, Title } from '@data-access';
import { TitlesRenderer, TranslationRenderer } from './types';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { useNavigation } from './NavigationProvider';
import { SourceReader } from './SourceReader';

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
  const [alignments, setAlignments] = useState<TranslationEditorContent>();

  useEffect(() => {
    const passages = body as TranslationEditorContentItem[];
    const alignments = passages.filter((item) =>
      COMPARE_MODE.includes((item.attrs?.type || '').replace('Header', '')),
    );
    setAlignments(alignments);
  }, [body]);

  const theTitles = useMemo(
    () => (
      <div className="ms-12 mt-12 mb-8">
        {renderTitles({ titles, imprint })}
      </div>
    ),

    [titles, imprint, renderTitles],
  );

  return (
    <Tabs
      value={panels.main.tab || 'translation'}
      onValueChange={(tabName) => {
        const tab = tabName as 'translation' | 'source' | 'compare';
        updatePanel({ name: 'main', state: { open: true, tab } });
      }}
      data-position="main"
      defaultValue="translation"
      className="px-8 w-full"
    >
      <TabsList className="sticky top-3 mx-auto -mt-25 z-10">
        <TabsTrigger value="translation">Translation</TabsTrigger>
        <TabsTrigger value="source">Source</TabsTrigger>
        {alignments && alignments.length > 0 && (
          <TabsTrigger value="compare">Compare</TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="translation">
        <div className="w-full max-w-5xl mx-auto">
          {theTitles}
          {renderTranslation({
            content: body,
            className: 'block pb-32',
            name: 'translation',
          })}
        </div>
      </TabsContent>
      <TabsContent value="source" className="pb-32">
        <SourceReader />
      </TabsContent>
      {alignments && alignments.length > 0 && (
        <TabsContent value="compare">
          <div className="w-full 2xl:max-w-7xl max-w-5xl mx-auto mt-8">
            {renderTranslation({
              content: alignments,
              className: 'block pb-32',
              name: 'translation',
            })}
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
};
