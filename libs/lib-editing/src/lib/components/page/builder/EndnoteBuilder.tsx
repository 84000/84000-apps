'use client';

import { createBrowserClient, getTranslationEndnotes } from '@data-access';
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import type { XmlFragment } from 'yjs';
import { EndNotesEditor, type BlockEditorContent } from '../../editor';
import { blocksFromTranslationBody } from '../../../block';
import { useEditorState } from '../EditorProvider';
import { TranslationSkeleton } from '../TranslationSkeleton';

export const EndnoteBuilder = () => {
  const [content, setContent] = useState<BlockEditorContent[]>();
  const [loading, setLoading] = useState(true);
  const [fragment, setFragment] = useState<XmlFragment>();

  const { uuid, getFragment } = useEditorState();

  useEffect(() => {
    const getTranslation = async () => {
      const client = createBrowserClient();
      const body = await getTranslationEndnotes({ client, uuid });

      setLoading(false);

      if (!body) {
        return;
      }

      setFragment(getFragment());

      const content = blocksFromTranslationBody(body);
      setContent(content);
    };
    getTranslation();
  }, [uuid, getFragment]);

  if (!content && !loading) {
    return notFound();
  }

  return content && fragment ? (
    <EndNotesEditor content={content} fragment={fragment} />
  ) : (
    <TranslationSkeleton />
  );
};
