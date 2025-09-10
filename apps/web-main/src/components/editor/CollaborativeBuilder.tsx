'use client';

import { DataClient, Passage, createBrowserClient } from '@data-access';
import { useEffect, useState } from 'react';
import { useEditorState } from './EditorContext';
import { TranslationBodyEditor } from '../ui/TranslationBodyEditor';
import { TranslationSkeleton } from '../ui/TranslationSkeleton';
import { notFound } from 'next/navigation';
import type { XmlFragment } from 'yjs';
import { EditorBuilderType } from './EditorBuilderType';

export const CollaborativeBuilder = ({
  builder,
  fetchContent,
}: {
  builder: EditorBuilderType;
  fetchContent: ({
    client,
    uuid,
  }: {
    client: DataClient;
    uuid: string;
  }) => Promise<Passage[]>;
}) => {
  const client = createBrowserClient();
  const [body, setBody] = useState<Passage[]>();
  const [fragment, setFragment] = useState<XmlFragment>();
  const [isObserving, setIsObserving] = useState(false);
  const [loading, setLoading] = useState(true);

  const {
    uuid,
    builder: currentBuilder,
    startObserving,
    getFragment,
    fetchEndNote,
  } = useEditorState();

  useEffect(() => {
    if (!loading || currentBuilder !== builder) {
      return;
    }

    const getContent = async () => {
      if (!loading) {
        return;
      }

      const body = await fetchContent({ client, uuid });

      if (!body) {
        return;
      }

      setBody(body);
      setLoading(false);
    };

    setFragment(getFragment());
    getContent();
  }, [
    uuid,
    loading,
    currentBuilder,
    client,
    builder,
    getFragment,
    fetchContent,
  ]);

  if (!body && !loading) {
    return notFound();
  }

  return body && fragment ? (
    <TranslationBodyEditor
      body={body}
      fragment={getFragment()}
      fetchEndNote={fetchEndNote}
      onCreate={() => {
        if (!isObserving) {
          setIsObserving(true);
          startObserving();
        }
      }}
    />
  ) : (
    <TranslationSkeleton />
  );
};
