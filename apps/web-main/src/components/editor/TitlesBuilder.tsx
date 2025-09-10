'use client';

import { createBrowserClient, getTranslationTitles } from '@data-access';
import {
  useEditorState,
  BlockEditorContent,
  TitlesEditor,
  TranslationSkeleton,
} from '@lib-editing';
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { titlesToDocument } from '@lib-editing';

export const TitlesBuilder = () => {
  const [content, setContent] = useState<BlockEditorContent>();
  const [loading, setLoading] = useState(true);

  const { uuid } = useEditorState();

  useEffect(() => {
    const getTitles = async () => {
      const client = createBrowserClient();
      const titles = await getTranslationTitles({ client, uuid });

      setLoading(false);

      if (!titles) {
        return;
      }

      const doc = titlesToDocument(titles);
      setContent(doc);
    };
    getTitles();
  }, [uuid]);

  if (!content && !loading) {
    return notFound();
  }

  return content ? <TitlesEditor content={content} /> : <TranslationSkeleton />;
};
