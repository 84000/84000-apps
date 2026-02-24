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
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@lib-utils';
import { useNavigation } from './NavigationProvider';
import { SourceReader } from './SourceReader';
import { Imprint } from './Imprint';
import {
  capturePassageAnchor,
  findScrollParent,
  usePassageAnchorRestore,
  useScrollPositionRestore,
} from './hooks/useScrollPositionRestore';

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
  const tabsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const activeTab = panels.main.tab || 'translation';

  // Once the user first visits Compare, keep its editor alive so subsequent
  // switches are instant. The editor must be born while the active tab is
  // 'compare' so that TipTap node views pick up isCompare=true from context.
  const [compareActivated, setCompareActivated] = useState(false);

  useEffect(() => {
    if (activeTab === 'compare' && !compareActivated) {
      setCompareActivated(true);
    }
  }, [activeTab, compareActivated]);

  const tabsRefCallback = useCallback((node: HTMLDivElement | null) => {
    tabsRef.current = node;
    // Only track scroll for visible instances (skip the hidden mobile duplicate)
    scrollContainerRef.current =
      node && node.offsetParent !== null ? findScrollParent(node) : null;
  }, []);

  useScrollPositionRestore(
    'main',
    scrollContainerRef,
    panels.main.tab,
    !!panels.main.hash,
  );

  const passageAnchorRef = usePassageAnchorRestore(
    scrollContainerRef,
    panels.main.tab,
  );

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
      ref={tabsRefCallback}
      value={panels.main.tab || 'translation'}
      onValueChange={(tabName) => {
        const tab = tabName as 'translation' | 'source' | 'compare';
        // Snapshot the topmost visible passage so we can realign after
        // the tab switch (content width may differ between tabs).
        if (scrollContainerRef.current) {
          passageAnchorRef.current = capturePassageAnchor(
            scrollContainerRef.current,
          );
        }
        updatePanel({ name: 'main', state: { open: true, tab } });
      }}
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
      {/* Translation uses forceMount so its TipTap editor stays alive when
         switching to Compare or other tabs, avoiding expensive re-creation. */}
      <TabsContent
        value="translation"
        forceMount
        className={cn(activeTab !== 'translation' && 'hidden')}
      >
        <div className="w-full max-w-readable mx-auto">
          {renderTranslation({
            content: body,
            className: 'block',
            name: 'translation',
            panel: 'main',
          })}
        </div>
      </TabsContent>
      <TabsContent value="source" className="pb-2">
        <SourceReader />
      </TabsContent>
      {/* Compare is lazily mounted on first activation so its TipTap editor is
         born while panels.main.tab === 'compare', ensuring Passage node views
         detect compare mode. Once created, it stays alive via CSS hiding. */}
      {alignments && alignments.length > 0 && compareActivated && (
        <div className={cn('mt-2', activeTab !== 'compare' && 'hidden')}>
          <div className="w-full 2xl:max-w-7xl max-w-5xl mx-auto mt-8">
            {renderTranslation({
              content: alignments,
              className: 'block',
              name: 'translation',
              panel: 'main',
            })}
          </div>
        </div>
      )}
    </Tabs>
  );
};
