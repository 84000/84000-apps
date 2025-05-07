'use client';

import {
  Titles,
  createBrowserClient,
  getTranslationTitles,
} from '@data-access';
import { useEffect, useState } from 'react';
import { useEditorState } from './EditorContext';
import { TranslationSkeleton } from '../ui/TranslationSkeleton';
import { notFound } from 'next/navigation';
import { TitleForm } from '@design-system';

export const TitlesBuilder = () => {
  const [body, setBody] = useState<Titles>();
  const [loading, setLoading] = useState(true);

  const { uuid } = useEditorState();

  useEffect(() => {
    const getTranslation = async () => {
      const client = createBrowserClient();
      const body = await getTranslationTitles({ client, uuid });

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

  return body ? (
    <TitleForm
      titles={body}
      onChange={(title) => {
        console.log(title);
      }}
    />
  ) : (
    <TranslationSkeleton />
  );
};
