'use client';

import {
  BODY_MATTER_FILTER,
  FRONT_MATTER_FILTER,
  Titles as TitlesData,
} from '@data-access';
import { BodyPanel } from '../shared/BodyPanel';
import { TranslationEditorContent } from '../editor';
import { TranslationReader } from '.';
import { Titles } from '@design-system';

export const ReaderBodyPanel = ({
  titles,
  frontMatter,
  body,
}: {
  titles: TitlesData;
  frontMatter: TranslationEditorContent;
  body: TranslationEditorContent;
  cursor?: string;
}) => {
  return (
    <BodyPanel
      titles={titles}
      frontMatter={frontMatter}
      body={body}
      renderTitles={({ titles, imprint }) => (
        <Titles titles={titles} imprint={imprint} />
      )}
      renderTranslation={({ content, name, className }) => (
        <TranslationReader
          content={content}
          name={name}
          className={className}
          filter={name === 'front' ? FRONT_MATTER_FILTER : BODY_MATTER_FILTER}
          panel="main"
        />
      )}
    />
  );
};
