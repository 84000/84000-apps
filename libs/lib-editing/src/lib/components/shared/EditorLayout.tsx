'use client';

import { LeftPanel, MainPanel, RightPanel, ThreeColumns } from '@design-system';
import { ReactNode, use, useEffect, useState } from 'react';
import { EditorContextProvider } from './EditorProvider';
import {
  createBrowserClient,
  getTranslationMetadataByUuid,
  Work,
} from '@data-access';
import { TranslationSkeleton } from './TranslationSkeleton';

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
      <div className="absolute fixed top-0 w-full bg-[url(/images/backgrounds/bg-reader.webp)] h-150 bg-[length:100%_auto] -z-10" />
      <div className="absolute fixed top-0 w-full h-150 bg-gradient-to-b from-50% to-white -z-10" />
      <ThreeColumns>
        <LeftPanel>{left}</LeftPanel>
        <MainPanel>{main}</MainPanel>
        <RightPanel>{right}</RightPanel>
      </ThreeColumns>
    </EditorContextProvider>
  );
};
