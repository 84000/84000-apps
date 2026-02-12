'use client';

import { ReactNode, use, useEffect, useState } from 'react';
import { EditorContextProvider } from './EditorProvider';
import {
  createGraphQLClient,
  getTranslationMetadataByUuid,
  Work,
} from '@client-graphql';
import { ThreeColumnRenderer, TranslationSkeleton } from '../shared';
import {
  LeftPanel,
  MainPanel,
  MainPanelHeader,
  RightPanel,
} from '@design-system';
import { EditorHeader } from './EditorHeader';

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
      const client = createGraphQLClient();
      const work = await getTranslationMetadataByUuid({
        client,
        uuid: slug,
      });
      if (work) {
        setWork(work);
      }
    })();
  }, [slug]);

  if (!work) {
    return <TranslationSkeleton />;
  }

  return (
    <EditorContextProvider work={work}>
      <ThreeColumnRenderer withHeader={true}>
        <LeftPanel>{left}</LeftPanel>
        <MainPanelHeader>
          <EditorHeader />
        </MainPanelHeader>
        <MainPanel>{main}</MainPanel>
        <RightPanel>{right}</RightPanel>
      </ThreeColumnRenderer>
    </EditorContextProvider>
  );
};
