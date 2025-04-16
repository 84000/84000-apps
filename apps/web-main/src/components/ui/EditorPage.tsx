'use client';

import {
  LeftPanel,
  MainPanel,
  RightPanel,
  ThreeColumns,
  Title,
} from '@design-system';
import { TranslationBodyEditor } from './TranslationBodyEditor';
import {
  Body,
  createBrowserClient,
  getTranslationBody,
  getTranslationMetadataByUuid,
} from '@data-access';
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { TranslationSkeleton } from './TranslationSkeleton';

export const EditorPage = ({ uuid }: { uuid: string }) => {
  const [body, setBody] = useState<Body>();
  const [title, setTitle] = useState('Untitled');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getTranslation = async () => {
      const client = createBrowserClient();
      const body = await getTranslationBody({ client, uuid });
      const { title } = await getTranslationMetadataByUuid({ client, uuid });

      setLoading(false);

      if (!body) {
        return;
      }

      setTitle(title);
      setBody(body);
    };
    getTranslation();
  }, [uuid]);

  if (!body && !loading) {
    return notFound();
  }

  return (
    <ThreeColumns>
      <LeftPanel>
        <div className="flex justify-center">
          <div className="text-muted-foreground p-4">Coming soon...</div>
        </div>
      </LeftPanel>
      <MainPanel>
        <div className="flex flex-col w-full xl:px-32 lg:px-16 md:px-8 px-4">
          {body ? (
            <>
              <Title language={'en'}>{title}</Title>
              <TranslationBodyEditor body={body} />
            </>
          ) : (
            <TranslationSkeleton />
          )}
        </div>
      </MainPanel>
      <RightPanel>
        <div className="flex justify-center">
          <div className="text-muted-foreground p-4">Coming soon...</div>
        </div>
      </RightPanel>
    </ThreeColumns>
  );
};
