'use client';

import { BODY_MATTER_FILTER, Titles as TitlesData } from '@data-access';
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
  cursor?: string;
}) => {
  return (
    <BodyPanel
      titles={titles}
      body={body}
      renderTitles={({ titles, imprint }) => (
        <Titles titles={titles} imprint={imprint} />
      )}
      renderTranslation={({ content, name, className }) => (
        <TranslationReader
          content={content}
          name={name}
          className={className}
          filter={BODY_MATTER_FILTER}
          panel="main"
        />
      )}
    />
  );
};
