'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TitleDetails,
} from '@design-system';
import {
  TranslationEditorContent,
  TranslationEditorContentItem,
} from '../editor';
import { COMPARE_MODE, Title } from '@data-access';
import { TitlesRenderer, TranslationRenderer } from './types';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { useNavigation } from './NavigationProvider';
import { SourceReader } from './SourceReader';
import { Imprint } from './Imprint';

export const BodyPanel = ({
  titles,
  frontMatter,
  body,
  renderTitles,
  renderTranslation,
}: {
  titles: Title[];
  frontMatter: TranslationEditorContent;
  body: TranslationEditorContent;
  renderTitles: (params: TitlesRenderer) => ReactElement<TitlesRenderer>;
  renderTranslation: (
    params: TranslationRenderer,
  ) => ReactElement<TranslationRenderer>;
}) => {
  const { panels, imprint, showOuterContent, updatePanel } = useNavigation();
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
      <div className="mt-16 mb-8">
        {renderTitles({
          titles,
          imprint,
          name: panels.main.tab || 'translation',
        })}
      </div>
    ),

    [titles, imprint, renderTitles, panels.main.tab],
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
      className="px-12 w-full"
    >
      <div className="sticky top-0.75 -mt-28 z-10 w-full overflow-x-auto text-center">
        <TabsList className="w-fit inline-flex">
          <TabsTrigger value="front">Front</TabsTrigger>
          <TabsTrigger value="translation">Translation</TabsTrigger>
          <TabsTrigger value="source">Source</TabsTrigger>
          {alignments && alignments.length > 0 && (
            <TabsTrigger value="compare">Compare</TabsTrigger>
          )}
        </TabsList>
      </div>
      {showOuterContent ? theTitles : null}
      <TabsContent value="front">
        <div className="w-full max-w-readable mx-auto">
          {showOuterContent ? (
            <div className="mb-12">
              {imprint && <TitleDetails imprint={imprint} />}
              <Imprint imprint={imprint} />
            </div>
          ) : null}
          {renderTranslation({
            content: frontMatter,
            className: 'block',
            name: 'front',
            panel: 'main',
          })}
        </div>
      </TabsContent>
      <TabsContent value="translation">
        <div className="w-full max-w-readable mx-auto">
          {renderTranslation({
            content: body,
            className: 'block',
            name: 'translation',
            panel: 'main',
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
              className: 'block',
              name: 'translation',
              panel: 'main',
            })}
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
};
