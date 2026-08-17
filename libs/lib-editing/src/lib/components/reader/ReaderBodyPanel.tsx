'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BODY_MATTER_FILTER,
  createBrowserClient,
  FRONT_MATTER_FILTER,
  getSession,
  Titles as TitlesData,
  UserRole,
} from '@eightyfourthousand/data-access';
import { BodyPanel } from '../shared/BodyPanel';
import { Titles, TitlesVariant } from '../shared/titles';
import {
  TitlesRenderer,
  TranslationRenderer,
  TranslationState,
} from '../shared/types';
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
