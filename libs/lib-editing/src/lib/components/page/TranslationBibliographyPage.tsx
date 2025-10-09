'use client';

import {
  BibliographyEntries,
  createBrowserClient,
  getBibliographyEntries,
} from '@data-access';
import { useEffect, useState } from 'react';
import { TranslationSkeleton } from './TranslationSkeleton';
import { useScrollToHash } from '@lib-utils';
import { useEditorState } from './EditorProvider';
import { BibliographyList } from './bibliography';

export const TranslationBibliographyPage = () => {
  const [content, setContent] = useState<BibliographyEntries>([]);
  const [loading, setLoading] = useState(true);

  const { uuid } = useEditorState();
  useScrollToHash({ isReady: !loading });

  useEffect(() => {
    (async () => {
      const client = createBrowserClient();
      const items = (await getBibliographyEntries({ client, uuid })) ?? [];
      setContent(items);
      setLoading(false);
    })();
  }, [uuid]);

  if (loading) {
    return <TranslationSkeleton />;
  }

  return <BibliographyList content={content} />;
};
