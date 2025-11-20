'use client';

import { createBrowserClient, getTranslationToc, Toc } from '@data-access';
import { FrontMatterPanel } from '../shared/FrontMatterPanel';
import { useEditorState } from './EditorProvider';
import { useEffect, useState } from 'react';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';

export const EditorFrontMatterPage = () => {
  const { work } = useEditorState();
  const [toc, setToc] = useState<Toc>();

  useEffect(() => {
    (async () => {
      const client = createBrowserClient();
      const toc = await getTranslationToc({ client, uuid: work.uuid });
      setToc(toc);
    })();
  }, [work.uuid]);

  if (!toc) {
    return <TranslationSkeleton />;
  }

  return <FrontMatterPanel toc={toc} work={work} />;
};
