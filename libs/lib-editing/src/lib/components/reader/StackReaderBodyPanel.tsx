'use client';

import { useCallback } from 'react';
import type {
  Titles as TitlesData,
  TranslationEditorContent,
} from '@eightyfourthousand/data-access';
import { BodyPanel } from '../shared/BodyPanel';
import type { TranslationRenderer } from '../shared/types';
import { StackTab } from '../stack/StackTab';
import { useReaderBody } from './useReaderBody';

/** The front tab's content: its stack reads it. */
const NO_CONTENT: TranslationEditorContent = [];

/**
 * The reader's main panel with its front matter and translation drawn as
 * passage stacks, under a `StackReaderProvider`.
 */
export const StackReaderBodyPanel = ({
  titles,
  body,
  isPublished,
}: {
  titles: TitlesData;
  /** The translation's first passages, which decide the empty state and Compare. */
  body: TranslationEditorContent;
  /** From `publicationStatus`; undefined while unknown. */
  isPublished?: boolean;
}) => {
  const { translationState, renderTitles } = useReaderBody({
    body,
    isPublished,
  });

  const renderTranslation = useCallback(
    ({ name, className }: TranslationRenderer) => (
      // Compare is drawn in the translation tab, so it shares that stack.
      <StackTab tab={name} className={className} />
    ),
    [],
  );

  return (
    <BodyPanel
      titles={titles}
      frontMatter={NO_CONTENT}
      body={body}
      renderTitles={renderTitles}
      renderTranslation={renderTranslation}
      translationState={translationState}
    />
  );
};
