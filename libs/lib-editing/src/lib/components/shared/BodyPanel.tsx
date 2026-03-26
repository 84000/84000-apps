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
import { TitlesRenderer, TranslationRenderer } from './types';
import { ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@eightyfourthousand/lib-utils';
import { useNavigation } from './NavigationProvider';
import { SourceReader } from './SourceReader';
import { Imprint } from './Imprint';
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
  renderTitles,
  renderTranslation,
  limitWhenNoTranslation = false,
}: {
  titles: Title[];
  frontMatter: TranslationEditorContent;
  body: TranslationEditorContent;
  renderTitles: (params: TitlesRenderer) => ReactElement<TitlesRenderer>;
  renderTranslation: (
    params: TranslationRenderer,
  ) => ReactElement<TranslationRenderer>;
  limitWhenNoTranslation?: boolean;
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
  const hasTranslationContent = useMemo(() => {
    if (!limitWhenNoTranslation) {
      return true;
    }
    if (Array.isArray(body)) {
      return body.length > 0;
    }
    return Boolean(body);
  }, [body, limitWhenNoTranslation]);
  const activeTab =
    panels.main.tab || (hasTranslationContent ? 'translation' : 'source');
  const safeTab =
    !hasTranslationContent &&
      (activeTab === 'translation' || activeTab === 'compare')
      ? 'source'
      : activeTab;

  const hasAlignments = useMemo(() => {
    if (!hasTranslationContent) {
      return false;
    }
    const passages = body as TranslationEditorContentItem[];
    return passages.some(
      (item) => Object.keys(item.attrs?.alignments || {}).length > 0,
    );
  }, [body, hasTranslationContent]);

  useEffect(() => {
    if (!limitWhenNoTranslation) {
      return;
    }
    setHasTranslationContent(hasTranslationContent);
  }, [hasTranslationContent, limitWhenNoTranslation, setHasTranslationContent]);

  const tabsRefCallback = useCallback((node: HTMLDivElement | null) => {
    tabsRef.current = node;
    // Only track scroll for visible instances (skip the hidden mobile duplicate)
    scrollContainerRef.current =
      node && node.offsetParent !== null ? findScrollParent(node) : null;
  }, []);

  const passageAnchorRef = usePassageAnchorRestore(
    scrollContainerRef,
    safeTab,
  );

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
      defaultValue={hasTranslationContent ? 'translation' : 'source'}
      className="px-12 w-full"
    >
      <div className="sticky top-0.75 -mt-28 z-10 w-full overflow-x-auto text-center">
        <TabsList className="w-fit inline-flex">
          <TabsTrigger value="front">Front</TabsTrigger>
          {hasTranslationContent && (
            <TabsTrigger value="translation">Translation</TabsTrigger>
          )}
          {hasTranslationContent && hasAlignments && (
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
          })}
        </div>
      </TabsContent>
      {/* Single editor instance shared between Translation and Compare tabs.
         Passage node views reactively show/hide the Tibetan source column
         based on the active tab from NavigationContext. */}
      {hasTranslationContent && (
        <TabsContent
          value="translation"
          forceMount
          className={cn(
            safeTab !== 'translation' && safeTab !== 'compare' && 'hidden',
          )}
        >
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
            })}
          </div>
        </TabsContent>
      )}
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
