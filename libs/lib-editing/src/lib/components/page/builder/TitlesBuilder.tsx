'use client';

import { createBrowserClient, getTranslationTitles } from '@data-access';
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { useEditorState } from '../EditorProvider';
import { titlesToDocument } from '../../../titles';
import { type BlockEditorContent, TitlesEditor } from '../../editor';
import { TranslationSkeleton } from '../TranslationSkeleton';

const WRAPPER_CLASS =
  'flex flex-col w-full xl:px-32 lg:px-16 md:px-8 px-4 py-(--header-height)';

export const TitlesBuilder = () => {
  const [content, setContent] = useState<BlockEditorContent>();
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
      const doc = titlesToDocument(titles);
      const editable = await canEdit();

      setIsEditable(editable);
      setContent(doc);
      setLoading(false);
    };
    getTitles();
  }, [uuid, loading, canEdit]);

  if (!content && !loading) {
    return notFound();
  }

  return content ? (
    <TitlesEditor
      isEditable={isEditable}
      className={WRAPPER_CLASS}
      content={content}
    />
  ) : (
    <TranslationSkeleton className={WRAPPER_CLASS} />
  );
};
