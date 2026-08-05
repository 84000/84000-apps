'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@eightyfourthousand/design-system';
import { TabName } from './types';
import { useEffect } from 'react';
import { useNavigation } from './NavigationProvider';
import { Toc, Work } from '@eightyfourthousand/data-access';
import { TableOfContents } from './TableOfContents';
import { useTohToggle } from './hooks/useTohToggle';
import { cn, useIsMobile } from '@eightyfourthousand/lib-utils';
import { PublishingPanel } from './PublishingPanel';

export const LeftPanel = ({
  toc,
  work,
  limitWhenNoTranslation = false,
  isEditor = false,
}: {
  toc?: Toc;
  work: Work;
  limitWhenNoTranslation?: boolean;
  /**
   * Editors only: readers have no use for publish validation, and the query behind it
   * requires editor.admin.
   */
  isEditor?: boolean;
}) => {
  const { panels, toh, updatePanel, setToh } = useNavigation();
  const isMobile = useIsMobile();
  useTohToggle({ toh });

  useEffect(() => {
    const currentToh = toh || work.toh[0] || '';
    setToh(currentToh);
  }, [toh, work.toh, setToh]);

  return (
    <Tabs
      value={panels.left.tab || 'toc'}
      onValueChange={(tabName) => {
        const tab = tabName as TabName;
        updatePanel({ name: 'left', state: { open: true, tab } });
      }}
      defaultValue="toc"
      className="w-full gap-0 @container/sidebar h-full flex flex-col"
    >
      <div className="sticky top-0 pt-1 pb-2 z-10 w-full rounded-t bg-background overflow-x-auto text-center">
        <TabsList
          className={cn(
            'w-fit px-6 inline-flex mx-auto rounded-none',
            isMobile && 'ps-12',
          )}
        >
          <TabsTrigger value="toc">Table of Contents</TabsTrigger>
          {isEditor && <TabsTrigger value="publishing">Publishing</TabsTrigger>}
        </TabsList>
      </div>
      <div className="flex-1 min-h-0">
        <div className="overflow-auto h-full bg-surface">
          <div className="rounded px-2 pb-8 max-w-readable mx-auto">
            <TabsContent value="toc" className="px-2 mt-1.5">
              <TableOfContents
                toc={toc}
                work={work}
                limitWhenNoTranslation={limitWhenNoTranslation}
              />
            </TabsContent>
            {/* Deliberately not forceMount, unlike the table of contents. Validation is a
                live query costing roughly 0.8 ms per passage, so it must not run for every
                editor who opens a work — only for one who asks. */}
            {isEditor && (
              <TabsContent value="publishing" className="px-2 mt-1.5">
                <PublishingPanel
                  workUuid={work.uuid}
                  workLabel={work.toh[0] || work.title || 'this work'}
                />
              </TabsContent>
            )}
          </div>
        </div>
      </div>
    </Tabs>
  );
};
