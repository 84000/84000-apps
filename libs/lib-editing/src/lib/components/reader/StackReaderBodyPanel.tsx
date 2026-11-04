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

/** What a tab draws for a work that is not published. */
const NOTHING = <></>;

/**
 * The reader's main panel with its front matter and translation drawn as
 * passage stacks, under a `StackReaderLayout`.
 *
 * A work that is not published shows its titles and the unpublished state
 * alone, to every visitor, as the layout holds no stacks for it.
 */
export const StackReaderBodyPanel = ({
  titles,
  body,
  isPublished,
}: {
  titles: TitlesData;
  /** The translation's first passages, which decide the empty state and Compare. */
  body: TranslationEditorContent;
  /** From `publicationStatus`; false when it could not be read. */
  isPublished?: boolean;
}) => {
  const gated = isPublished === false;
  const { translationState, renderTitles } = useReaderBody({
    body,
    isPublished,
  });

  const renderTranslation = useCallback(
    ({ name, className }: TranslationRenderer) =>
      gated ? (
        NOTHING
      ) : (
        // Compare is drawn in the translation tab, so it shares that stack.
        <StackTab tab={name} className={className} />
      ),
    [gated],
  );

  return (
    <BodyPanel
      titles={titles}
      frontMatter={NO_CONTENT}
      body={body}
      renderTitles={renderTitles}
      renderTranslation={renderTranslation}
      translationState={gated ? 'unpublished' : translationState}
      withImprint={!gated}
    />
  );
};
