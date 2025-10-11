'use client';

import {
  createBrowserClient,
  getTranslationTitles,
  Titles as TitlesData,
} from '@data-access';
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { useEditorState } from '../EditorProvider';
import { TranslationSkeleton } from '../TranslationSkeleton';
import { Titles } from '@design-system';

const WRAPPER_CLASS = 'w-full py-16';

export const TitlesBuilder = () => {
  const [content, setContent] = useState<TitlesData>();
  const [isEditable, setIsEditable] = useState(false);
  const [loading, setLoading] = useState(true);

  const { uuid, canEdit } = useEditorState();

  useEffect(() => {
    const getTitles = async () => {
      if (!loading) {
        return;
      }

      const client = createBrowserClient();
      const titles = await getTranslationTitles({ client, uuid });
      const editable = await canEdit();

      setIsEditable(editable);
      setContent(titles);
      setLoading(false);
    };
    getTitles();
  }, [uuid, loading, canEdit]);

  if (!content && !loading) {
    return notFound();
  }

  return content ? (
    <div className={WRAPPER_CLASS}>
      <Titles titles={content} canEdit={isEditable} />
    </div>
  ) : (
    <TranslationSkeleton className={WRAPPER_CLASS} />
  );
};
