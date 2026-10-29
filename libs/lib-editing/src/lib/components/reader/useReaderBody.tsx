'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createBrowserClient,
  getSession,
  type TranslationEditorContent,
  type UserRole,
} from '@eightyfourthousand/data-access';
import { Titles, type TitlesVariant } from '../shared/titles';
import type { TitlesRenderer, TranslationState } from '../shared/types';

const TITLE_VARIANTS_FOR_TABS: { [key: string]: TitlesVariant } = {
  translation: 'english',
  source: 'tibetan',
  front: 'front',
  compare: 'comparison',
};

/**
 * What a reader's main panel shows, whatever draws its passages: the state of
 * the translation for the visitor's role, and the titles for each tab.
 */
export const useReaderBody = ({
  body,
  isPublished,
}: {
  body: TranslationEditorContent;
  /** From `publicationStatus`; undefined while unknown. */
  isPublished?: boolean;
}) => {
  // `undefined` while the role resolves. Gate as a reader until then so
  // unpublished content never flashes before the role is known.
  const [role, setRole] = useState<UserRole | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const session = await getSession({ client: createBrowserClient() });
      // Unauthenticated visitors are treated as readers.
      setRole(session?.claims.role ?? 'reader');
    })();
  }, []);

  const translationState = useMemo<TranslationState>(() => {
    const isReader = role === undefined || role === 'reader';
    if (isReader && isPublished === false) {
      return 'unpublished';
    }
    const bodyEmpty = Array.isArray(body) ? body.length === 0 : !body;
    return bodyEmpty ? 'empty' : 'content';
  }, [role, isPublished, body]);

  const renderTitles = useCallback(
    ({ titles, imprint, name }: TitlesRenderer) => (
      <Titles
        titles={titles}
        imprint={imprint}
        variant={(TITLE_VARIANTS_FOR_TABS[name] || 'english') as TitlesVariant}
      />
    ),
    [],
  );

  return { translationState, renderTitles };
};
