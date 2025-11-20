'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import { TranslationEditorContent } from '../editor';
import { TranslationRenderer } from './types';
import { ReactElement, useEffect } from 'react';
import { useNavigation } from './NavigationProvider';
import { Toc, Work } from '@data-access';
import { TableOfContents } from './TableOfContents';
import { ImprintTab } from './ImprintTab';
import { useTohToggle } from './hooks/useTohToggle';

export const FrontMatterPanel = ({
  summary,
  toc,
  work,
  renderTranslation,
}: {
  summary: TranslationEditorContent;
  toc?: Toc;
  work: Work;
  renderTranslation: (
    params: TranslationRenderer,
  ) => ReactElement<TranslationRenderer>;
}) => {
  const { panels, imprint, toh, updatePanel, setToh } = useNavigation();
  useTohToggle({ work, toh });

  useEffect(() => {
    const currentToh = toh || work.toh[0] || '';
    setToh(currentToh);
  }, [toh, work.toh, setToh]);

  return (
    <Tabs
      value={panels.left.tab || 'toc'}
      onValueChange={(tabName) => {
        const tab = tabName as 'toc' | 'summary' | 'imprint';
        updatePanel({ name: 'left', state: { open: true, tab } });
      }}
      data-position="sidebar"
      defaultValue="toc"
    >
      <TabsList className="sticky top-0 py-8 mx-auto z-10 w-full rounded-none bg-muted">
        <TabsTrigger value="toc">Navigation</TabsTrigger>
        {summary.length > 0 && (
          <TabsTrigger value="summary">Summary</TabsTrigger>
        )}
        <TabsTrigger value="imprint">Imprint</TabsTrigger>
      </TabsList>
      <div className="px-8 max-w-readable w-full mx-auto">
        <TabsContent value="toc" className="pb-8">
          <TableOfContents toc={toc} work={work} />
        </TabsContent>
        {summary.length > 0 && (
          <TabsContent value="summary">
            {renderTranslation({
              content: summary,
              className: 'block pb-8 pe-8',
              name: 'summary',
              panel: 'left',
            })}
          </TabsContent>
        )}
        <TabsContent value="imprint" className="pb-8">
          <ImprintTab imprint={imprint} />
        </TabsContent>
      </div>
    </Tabs>
  );
};
