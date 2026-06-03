'use client';

import { useCallback } from 'react';
import {
  BODY_MATTER_FILTER,
  FRONT_MATTER_FILTER,
  Titles as TitlesData,
} from '@eightyfourthousand/data-access';
import { BodyPanel } from '../shared/BodyPanel';
import { Titles, TitlesVariant } from '../shared/titles';
import { TitlesRenderer, TranslationRenderer } from '../shared/types';
import { TranslationEditorContent } from '../editor';
import { TranslationReader } from './TranslationReader';

const TITLE_VARIANTS_FOR_TABS: { [key: string]: TitlesVariant } = {
  translation: 'english',
  source: 'tibetan',
  front: 'front',
  compare: 'comparison',
};

export const ReaderBodyPanel = ({
  titles,
  frontMatter,
  body,
  frontMatterHasMore,
  bodyHasMore,
}: {
  titles: TitlesData;
  frontMatter: TranslationEditorContent;
  body: TranslationEditorContent;
  frontMatterHasMore?: boolean;
  bodyHasMore?: boolean;
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
    ({ content, name, className, hasMoreAfter }: TranslationRenderer) => (
      <TranslationReader
        content={content}
        name={name}
        className={className}
        filter={name === 'front' ? FRONT_MATTER_FILTER : BODY_MATTER_FILTER}
        panel="main"
        hasMoreAfter={hasMoreAfter}
      />
    ),
    [],
  );

  return (
    <BodyPanel
      titles={titles}
      frontMatter={frontMatter}
      body={body}
      frontMatterHasMore={frontMatterHasMore}
      bodyHasMore={bodyHasMore}
      renderTitles={renderTitles}
      renderTranslation={renderTranslation}
      limitWhenNoTranslation={true}
    />
  );
};
