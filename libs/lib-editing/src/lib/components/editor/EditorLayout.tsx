'use client';

import { ReactNode, use, useEffect, useState } from 'react';
import { EditorContextProvider } from './EditorProvider';
import {
  createBrowserClient,
  getTranslationMetadataByUuid,
  Work,
} from '@data-access';
import { ThreeColumnRenderer, TranslationSkeleton } from '../shared';

export const EditorLayout = ({
  left,
  main,
  right,
  params,
}: {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = use(params);
  const [work, setWork] = useState<Work>();

  useEffect(() => {
    (async () => {
      const client = createBrowserClient();
      const work = await getTranslationMetadataByUuid({
        client,
        uuid: slug,
      });
      setWork(work);
    })();
  }, [slug]);

  if (!work) {
    return <TranslationSkeleton />;
  }

  return (
    <EditorContextProvider work={work}>
      <ThreeColumnRenderer left={left} main={main} right={right} />
    </EditorContextProvider>
  );
};
