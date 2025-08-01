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
import type { XmlFragment } from 'yjs';

export const EndnoteBuilder = () => {
  const [body, setBody] = useState<Passage[]>();
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
      setBody(body);
    };
    getTranslation();
  }, [uuid, getFragment]);

  if (!body && !loading) {
    return notFound();
  }

  return body && fragment ? (
    <EndnoteBodyEditor body={body} fragment={fragment} />
  ) : (
    <TranslationSkeleton />
  );
};
