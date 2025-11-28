'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import { TabName } from './types';
import { useEffect } from 'react';
import { useNavigation } from './NavigationProvider';
import { Toc, Work } from '@data-access';
import { TableOfContents } from './TableOfContents';
import { useTohToggle } from './hooks/useTohToggle';
import { cn, useIsMobile } from '@lib-utils';

export const LeftPanel = ({ toc, work }: { toc?: Toc; work: Work }) => {
  const { panels, toh, updatePanel, setToh } = useNavigation();
  const isMobile = useIsMobile();
  useTohToggle({ work, toh });

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
      data-position="sidebar"
      defaultValue="toc"
      className="w-full"
    >
      <div className="sticky top-0 py-3 z-10 w-full rounded-none bg-muted overflow-x-auto text-center">
        <TabsList
          className={cn(
            'w-fit px-6 inline-flex mx-auto rounded-none',
            isMobile && 'ps-12',
          )}
        >
          <TabsTrigger value="toc">Table of Contents</TabsTrigger>
        </TabsList>
      </div>
      <div className="px-8 max-w-readable w-full mx-auto">
        <TabsContent value="toc" className="pb-8">
          <TableOfContents toc={toc} work={work} />
        </TabsContent>
      </div>
    </Tabs>
  );
};
