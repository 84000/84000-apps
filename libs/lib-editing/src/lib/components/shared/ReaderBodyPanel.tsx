'use client';

import { Titles } from '@data-access';
import { BodyPanel } from './BodyPanel';
import { TranslationEditorContent } from '../editor';
import { TranslationReader } from '../reader';

export const ReaderBodyPanel = ({
  titles,
  body,
}: {
  titles: Titles;
  body: TranslationEditorContent;
}) => {
  return (
    <BodyPanel
      titles={titles}
      body={body}
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
