'use client';

import {
  LeftPanel,
  MainPanel,
  RightPanel,
  ThreeColumns,
  Title,
} from '@design-system';
import { TranslationBodyEditor } from './TranslationBodyEditor';
import { Translation } from '@data-access';

export const revalidate = 60;
export const dynamicParams = true;

export const EditorPage = async ({
  publication,
}: {
  publication: Translation;
}) => {
  return (
    <ThreeColumns>
      <LeftPanel>
        <div className="flex justify-center">
          <div className="text-muted-foreground p-4">Coming soon...</div>
        </div>
      </LeftPanel>
      <MainPanel>
        <div className="flex flex-col w-full xl:px-32 lg:px-16 md:px-8 px-4">
          <Title language={'en'}>
            {publication.frontMatter.titles.find((t) => t.language === 'en')
              ?.title || 'Untitled'}
          </Title>
          <TranslationBodyEditor translation={publication} />
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
