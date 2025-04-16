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
  Translation,
  createBrowserClient,
  getTranslationByUuid,
} from '@data-access';
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { TranslationSkeleton } from './TranslationSkeleton';

export const EditorPage = ({ uuid }: { uuid: string }) => {
  const [translation, setTranslation] = useState<Translation>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getTranslation = async () => {
      const client = createBrowserClient();
      const translation = await getTranslationByUuid({ client, uuid });

      setLoading(false);

      if (!translation) {
        return;
      }

      setTranslation(translation);
    };
    getTranslation();
  }, [uuid]);

  if (!translation && !loading) {
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
          {translation ? (
            <>
              <Title language={'en'}>
                {translation.frontMatter.titles.find((t) => t.language === 'en')
                  ?.title || 'Untitled'}
              </Title>
              <TranslationBodyEditor translation={translation} />
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
