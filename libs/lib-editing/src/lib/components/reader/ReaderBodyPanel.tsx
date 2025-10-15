'use client';

import { Titles as TitlesData } from '@data-access';
import { BodyPanel } from '../shared/BodyPanel';
import { TranslationEditorContent } from '../editor';
import { TranslationReader } from '.';
import { Titles } from '@design-system';

export const ReaderBodyPanel = ({
  titles,
  body,
}: {
  titles: TitlesData;
  body: TranslationEditorContent;
}) => {
  return (
    <BodyPanel
      titles={titles}
      body={body}
      renderTitles={({ titles }) => <Titles titles={titles} />}
      renderTranslation={({ content, name, className }) => (
        <TranslationReader
          content={content}
          name={name}
          className={className}
        />
      )}
    />
  );
};
