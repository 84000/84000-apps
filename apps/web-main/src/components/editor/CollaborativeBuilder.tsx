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
  const [body, setBody] = useState<Passage[]>();
  const [fragment, setFragment] = useState<XmlFragment>();
  const [isObserving, setIsObserving] = useState(false);
  const [loading, setLoading] = useState(true);

  const {
    uuid,
    builder: currentBuilder,
    startObserving,
    getFragment,
  } = useEditorState();

  useEffect(() => {
    if (!loading || currentBuilder !== builder) {
      return;
    }

    const getContent = async () => {
      const client = createBrowserClient();
      const body = await fetchContent({ client, uuid });

      setLoading(false);

      if (!body) {
        return;
      }

      setBody(body);
    };

    setFragment(getFragment());
    getContent();
  }, [uuid, loading, currentBuilder, builder, getFragment, fetchContent]);

  if (!body && !loading) {
    return notFound();
  }

  return body && fragment ? (
    <TranslationBodyEditor
      body={body}
      fragment={getFragment()}
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
