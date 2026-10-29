'use client';

import { useCallback } from 'react';
import {
  BODY_MATTER_FILTER,
  FRONT_MATTER_FILTER,
  Titles as TitlesData,
} from '@eightyfourthousand/data-access';
import { BodyPanel } from '../shared/BodyPanel';
import { TranslationRenderer } from '../shared/types';
import { TranslationEditorContent } from '../editor';
import { TranslationReader } from './TranslationReader';
import { useReaderBody } from './useReaderBody';

export const ReaderBodyPanel = ({
  titles,
  frontMatter,
  body,
  frontMatterHasMore,
  bodyHasMore,
  isPublished,
}: {
  titles: TitlesData;
  frontMatter: TranslationEditorContent;
  body: TranslationEditorContent;
  frontMatterHasMore?: boolean;
  bodyHasMore?: boolean;
  cursor?: string;
  /**
   * Whether the work is published, decided by the caller from `publicationStatus`.
   *
   * Replaces a heuristic on the version number — major >= 1 counted as published, an
   * absent version counted as published too — which read three works wrongly, since a
   * published work can sit below 1.0.0 and an unpublished one can carry a legacy label
   * above it. Undefined while unknown, so nothing is gated on a guess.
   */
  isPublished?: boolean;
}) => {
  const { translationState, renderTitles } = useReaderBody({
    body,
    isPublished,
  });

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
      translationState={translationState}
    />
  );
};
