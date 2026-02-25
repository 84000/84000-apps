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
import { ReactElement, useCallback, useMemo, useRef } from 'react';
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
  const tabsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const activeTab = panels.main.tab || 'translation';

  const hasAlignments = useMemo(() => {
    const passages = body as TranslationEditorContentItem[];
    return passages.some((item) =>
      COMPARE_MODE.includes((item.attrs?.type || '').replace('Header', '')),
    );
  }, [body]);

  const tabsRefCallback = useCallback((node: HTMLDivElement | null) => {
    tabsRef.current = node;
    // Only track scroll for visible instances (skip the hidden mobile duplicate)
    scrollContainerRef.current =
      node && node.offsetParent !== null ? findScrollParent(node) : null;
  }, []);

  const passageAnchorRef = usePassageAnchorRestore(
    scrollContainerRef,
    panels.main.tab,
  );

  useScrollPositionRestore(
    'main',
    scrollContainerRef,
    panels.main.tab,
    !!panels.main.hash,
    passageAnchorRef,
  );

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
        const tab = tabName as 'translation' | 'source' | 'compare' | 'front';
        // Capture a passage anchor when leaving translation or compare.
        // These tabs contain passage elements whose UUID lets us realign
        // scroll position after the tab switch — immune to the scrollTop
        // clamping that happens when hidden content changes scroll height.
        const current = panels.main.tab || 'translation';
        const passageTabs = ['translation', 'compare'];
        if (scrollContainerRef.current && passageTabs.includes(current)) {
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
          {hasAlignments && (
            <TabsTrigger value="compare">Compare</TabsTrigger>
          )}
          <TabsTrigger value="source">Source</TabsTrigger>
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
      {/* Single editor instance shared between Translation and Compare tabs.
         Passage node views reactively show/hide the Tibetan source column
         based on the active tab from NavigationContext. */}
      <TabsContent
        value="translation"
        forceMount
        className={cn(
          activeTab !== 'translation' && activeTab !== 'compare' && 'hidden',
        )}
      >
        <div
          className={cn(
            'w-full mx-auto',
            activeTab === 'compare'
              ? '2xl:max-w-7xl max-w-5xl mt-8'
              : 'max-w-readable',
          )}
        >
          {renderTranslation({
            content: body,
            className: 'block',
            name: 'translation',
            panel: 'main',
          })}
        </div>
      </TabsContent>
      <TabsContent
        value="source"
        forceMount
        className="pb-2 data-[state=inactive]:hidden"
      >
        <SourceReader />
      </TabsContent>
    </Tabs>
  );
};
