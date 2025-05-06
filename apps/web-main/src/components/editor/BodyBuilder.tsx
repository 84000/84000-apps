'use client';

import { Body, createBrowserClient, getTranslationBody } from '@data-access';
import { useEffect, useState } from 'react';
import { useEditorState } from './EditorContext';
import { TranslationBodyEditor } from '../ui/TranslationBodyEditor';
import { TranslationSkeleton } from '../ui/TranslationSkeleton';
import { notFound } from 'next/navigation';

export const BodyBuilder = () => {
  const [body, setBody] = useState<Body>();
  const [loading, setLoading] = useState(true);

  const { uuid } = useEditorState();

  useEffect(() => {
    const getTranslation = async () => {
      const client = createBrowserClient();
      const body = await getTranslationBody({ client, uuid });

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

  return body ? <TranslationBodyEditor body={body} /> : <TranslationSkeleton />;
};
