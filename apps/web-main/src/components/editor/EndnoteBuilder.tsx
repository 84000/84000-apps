'use client';

import {
  Passage,
  createBrowserClient,
  getTranslationEndnotes,
} from '@data-access';
import { useEffect, useState } from 'react';
import { useEditorState } from './EditorContext';
import { TranslationSkeleton } from '../ui/TranslationSkeleton';
import { notFound } from 'next/navigation';
import { EndnoteBodyEditor } from '../ui/EndnoteBodyEditor';

export const EndnoteBuilder = () => {
  const [body, setBody] = useState<Passage[]>();
  const [loading, setLoading] = useState(true);

  const { uuid } = useEditorState();

  useEffect(() => {
    const getTranslation = async () => {
      const client = createBrowserClient();
      const body = await getTranslationEndnotes({ client, uuid });

      setLoading(false);

      if (!body) {
        return;
      }

      setBody(body);
    };
    getTranslation();
  }, [uuid]);

  if (!body && !loading) {
    return notFound();
  }

  return body ? <EndnoteBodyEditor body={body} /> : <TranslationSkeleton />;
};
