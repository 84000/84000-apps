'use client';

import {
  createBrowserClient,
  getTranslationMetadataByUuid,
} from '@data-access';
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { useEditorState } from './EditorProvider';
import { TranslationSkeleton } from './TranslationSkeleton';

export const EditorPage = () => {
  const [fetched, setFetched] = useState(false);
  const [loading, setLoading] = useState(true);

  const { uuid } = useEditorState();

  useEffect(() => {
    const getTranslation = async () => {
      const client = createBrowserClient();
      const meta = await getTranslationMetadataByUuid({ client, uuid });

      setLoading(false);
      setFetched(!!meta);
    };
    getTranslation();
  }, [uuid]);

  if (!fetched && !loading) {
    return notFound();
  }

  return <TranslationSkeleton />;
};
