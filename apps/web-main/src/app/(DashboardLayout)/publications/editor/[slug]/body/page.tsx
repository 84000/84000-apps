'use client';

import { TranslationBodyEditor } from '../../../../../../components/ui/TranslationBodyEditor';
import { Body, createBrowserClient, getTranslationByUuid } from '@data-access';
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { TranslationSkeleton } from '../../../../../../components/ui/TranslationSkeleton';
import { useEditorState } from '../../../../../../components/editor/EditorContext';

const Page = () => {
  const [body, setBody] = useState<Body>();
  const [loading, setLoading] = useState(true);

  const { uuid } = useEditorState();

  useEffect(() => {
    const getTranslation = async () => {
      const client = createBrowserClient();
      const translation = await getTranslationByUuid({ client, uuid });
      const body = translation?.body;

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

export default Page;
