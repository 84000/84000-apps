'use client';

import {
  createBrowserClient,
  getGlossaryInstances,
  GlossaryTermInstance,
} from '@data-access';
import { useEffect, useState } from 'react';
import { useEditorState } from './EditorProvider';
import { TranslationSkeleton } from './TranslationSkeleton';
import { useScrollToHash } from '@lib-utils';
import { GlossaryTermList } from './glossary';

export const TranslationGlossaryPage = () => {
  const [content, setContent] = useState<GlossaryTermInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const { uuid } = useEditorState();
  useScrollToHash({ isReady: !loading });

  useEffect(() => {
    (async () => {
      const client = createBrowserClient();
      const items = (await getGlossaryInstances({ client, uuid })) ?? [];
      items.sort((a, b) => {
        if (a.names.english && b.names.english) {
          return a.names.english.localeCompare(b.names.english);
        }
        if (a.names.wylie && b.names.wylie) {
          return a.names.wylie.localeCompare(b.names.wylie);
        }
        return 0;
      });

      setContent(items);
      setLoading(false);
    })();
  }, [uuid]);

  if (loading) {
    return <TranslationSkeleton />;
  }

  return <GlossaryTermList content={content} />;
};
