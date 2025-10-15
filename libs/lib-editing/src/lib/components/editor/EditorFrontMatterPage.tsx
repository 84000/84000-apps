'use client';

import {
  createBrowserClient,
  FRONT_MATTER_FILTER,
  getTranslationPassages,
} from '@data-access';
import { blocksFromTranslationBody } from '../../block';
import { FrontMatterPanel } from '../shared/FrontMatterPanel';
import { useEditorState } from './EditorProvider';
import { useEffect, useState } from 'react';
import { TranslationBuilder, TranslationEditorContent } from '.';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';

export const EditorFrontMatterPage = () => {
  const { work } = useEditorState();
  const [summary, setSummary] = useState<TranslationEditorContent>();

  useEffect(() => {
    (async () => {
      const client = createBrowserClient();
      const passages = await getTranslationPassages({
        client,
        uuid: work.uuid,
        type: FRONT_MATTER_FILTER,
      });
      const summary = blocksFromTranslationBody(passages);
      setSummary(summary);
    })();
  }, [work.uuid]);

  if (!summary) {
    return <TranslationSkeleton />;
  }

  return (
    <FrontMatterPanel
      summary={summary}
      renderTranslation={({ content, name, className }) => (
        <TranslationBuilder
          content={content}
          name={name}
          className={className}
        />
      )}
    />
  );
};
