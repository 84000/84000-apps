'use client';

import { createGraphQLClient, getTranslationToc } from '@client-graphql';
import type { Toc } from '@data-access';
import { LeftPanel } from '../shared/LeftPanel';
import { useEditorState } from './EditorProvider';
import { useEffect, useState } from 'react';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';

export const EditorLeftPanelPage = () => {
  const { work } = useEditorState();
  const [toc, setToc] = useState<Toc>();

  useEffect(() => {
    (async () => {
      const client = createGraphQLClient();
      const toc = await getTranslationToc({ client, uuid: work.uuid });
      setToc(toc);
    })();
  }, [work.uuid]);

  if (!toc) {
    return <TranslationSkeleton />;
  }

  return <LeftPanel toc={toc} work={work} />;
};
