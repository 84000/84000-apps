'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@eightyfourthousand/design-system';
import {
  TranslationEditorContent,
  TranslationEditorContentItem,
} from '../editor';
import { Title } from '@eightyfourthousand/data-access';
import { TitlesRenderer, TranslationRenderer, TranslationState } from './types';
import { ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@eightyfourthousand/lib-utils';
import { useNavigation } from './NavigationProvider';
import { SourceReader } from './SourceReader';
import { Imprint } from './Imprint';
import { TranslationPlaceholder } from './TranslationPlaceholder';
import { TitleDetails } from './titles';
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
  frontMatterHasMore,
  bodyHasMore,
  renderTitles,
  renderTranslation,
  translationState = 'content',
}: {
  titles: Title[];
  frontMatter: TranslationEditorContent;
  body: TranslationEditorContent;
  frontMatterHasMore?: boolean;
  bodyHasMore?: boolean;
  renderTitles: (params: TitlesRenderer) => ReactElement<TitlesRenderer>;
  renderTranslation: (
    params: TranslationRenderer,
  ) => ReactElement<TranslationRenderer>;
  translationState?: TranslationState;
}) => {
  const {
    panels,
    imprint,
    showOuterContent,
    updatePanel,
    setHasTranslationContent,
  } = useNavigation();
  const tabsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const hasContent = translationState === 'content';
  const activeTab = panels.main.tab || 'translation';
  // The translation tab is always available (it shows a placeholder message
  // when there's no content); only redirect away from the compare tab when
  // there's nothing to compare against.
  const safeTab =
    !hasContent && activeTab === 'compare' ? 'translation' : activeTab;

  const hasAlignments = useMemo(() => {
    if (!hasContent) {
      return false;
    }
    const passages = body as TranslationEditorContentItem[];
    return passages.some(
      (item) => Object.keys(item.attrs?.alignments || {}).length > 0,
    );
  }, [body, hasContent]);

  useEffect(() => {
    setHasTranslationContent(hasContent);
  }, [hasContent, setHasTranslationContent]);

  const tabsRefCallback = useCallback((node: HTMLDivElement | null) => {
    tabsRef.current = node;
    // Only track scroll for visible instances (skip the hidden mobile duplicate)
    scrollContainerRef.current =
      node && node.offsetParent !== null ? findScrollParent(node) : null;
  }, []);

  const passageAnchorRef = usePassageAnchorRestore(scrollContainerRef, safeTab);

  useScrollPositionRestore(
    'main',
    scrollContainerRef,
    safeTab,
    !!panels.main.hash,
    passageAnchorRef,
  );

  const theTitles = useMemo(
    () => (
      <div className="mt-16 mb-8">
        {renderTitles({
          titles,
          imprint,
          name: safeTab,
        })}
      </div>
    ),

    [titles, imprint, renderTitles, safeTab],
  );

  return (
    <Tabs
      ref={tabsRefCallback}
      value={safeTab}
      onValueChange={(tabName) => {
        const tab = tabName as 'translation' | 'source' | 'compare' | 'front';
        // Capture a passage anchor when leaving translation or compare.
        // These tabs contain passage elements whose UUID lets us realign
        // scroll position after the tab switch — immune to the scrollTop
        // clamping that happens when hidden content changes scroll height.
        const current = safeTab;
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
      <div className="sticky top-0.75 -mt-28 z-10 overflow-x-auto text-center pointer-events-none me-12 sm:me-0 md:w-full">
        <TabsList className="w-fit inline-flex pointer-events-auto">
          <TabsTrigger value="front">Front</TabsTrigger>
          <TabsTrigger value="translation">Translation</TabsTrigger>
          {hasAlignments && (
            <TabsTrigger value="compare">Compare</TabsTrigger>
          )}
          <TabsTrigger value="source">Source</TabsTrigger>
        </TabsList>
      </div>
      {showOuterContent && safeTab === 'front' ? theTitles : null}
      <TabsContent
        value="front"
        forceMount
        className={cn(safeTab !== 'front' && 'hidden')}
      >
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
            hasMoreAfter: frontMatterHasMore,
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
          safeTab !== 'translation' && safeTab !== 'compare' && 'hidden',
        )}
      >
        {hasContent ? (
          <div
            className={cn(
              'w-full mx-auto mt-8',
              safeTab === 'compare'
                ? '2xl:max-w-7xl max-w-5xl'
                : 'max-w-readable',
            )}
          >
            {renderTranslation({
              content: body,
              className: 'block',
              name: 'translation',
              panel: 'main',
              hasMoreAfter: bodyHasMore,
            })}
          </div>
        ) : (
          <TranslationPlaceholder state={translationState} />
        )}
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
