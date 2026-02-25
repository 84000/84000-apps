'use client';

import { useCallback } from 'react';
import {
  BODY_MATTER_FILTER,
  FRONT_MATTER_FILTER,
  Titles as TitlesData,
} from '@data-access';
import { BodyPanel } from '../shared/BodyPanel';
import { TitlesRenderer, TranslationRenderer } from '../shared/types';
import { TranslationEditorContent } from '../editor';
import { TranslationReader } from './TranslationReader';
import { Titles, TitlesVariant } from '@design-system';

const TITLE_VARIANTS_FOR_TABS: { [key: string]: TitlesVariant } = {
  translation: 'english',
  source: 'tibetan',
  front: 'english',
  compare: 'comparison',
};

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
  const renderTitles = useCallback(
    ({ titles, imprint, name }: TitlesRenderer) => (
      <Titles
        titles={titles}
        imprint={imprint}
        variant={
          (TITLE_VARIANTS_FOR_TABS[name] || 'english') as TitlesVariant
        }
      />
    ),
    [],
  );

  const renderTranslation = useCallback(
    ({ content, name, className }: TranslationRenderer) => (
      <TranslationReader
        content={content}
        name={name}
        className={className}
        filter={name === 'front' ? FRONT_MATTER_FILTER : BODY_MATTER_FILTER}
        panel="main"
      />
    ),
    [],
  );

  return (
    <BodyPanel
      titles={titles}
      frontMatter={frontMatter}
      body={body}
      renderTitles={renderTitles}
      renderTranslation={renderTranslation}
    />
  );
};
