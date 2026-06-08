'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BODY_MATTER_FILTER,
  createBrowserClient,
  FRONT_MATTER_FILTER,
  getSession,
  isPublishedVersion,
  SemVer,
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
  publicationVersion,
}: {
  titles: TitlesData;
  frontMatter: TranslationEditorContent;
  body: TranslationEditorContent;
  frontMatterHasMore?: boolean;
  bodyHasMore?: boolean;
  cursor?: string;
  publicationVersion?: SemVer;
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
    const unpublished = !isPublishedVersion(publicationVersion);
    if (isReader && unpublished) {
      return 'unpublished';
    }
    const bodyEmpty = Array.isArray(body) ? body.length === 0 : !body;
    return bodyEmpty ? 'empty' : 'content';
  }, [role, publicationVersion, body]);

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
