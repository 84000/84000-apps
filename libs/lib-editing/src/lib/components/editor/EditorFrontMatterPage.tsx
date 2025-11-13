'use client';

import {
  createBrowserClient,
  FRONT_MATTER_FILTER,
  getTranslationPassages,
  getTranslationToc,
  Toc,
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
  const [toc, setToc] = useState<Toc>();

  useEffect(() => {
    (async () => {
      const client = createBrowserClient();
      const { passages } = await getTranslationPassages({
        client,
        uuid: work.uuid,
        type: FRONT_MATTER_FILTER,
      });
      const summary = blocksFromTranslationBody(passages);
      setSummary(summary);

      const toc = await getTranslationToc({ client, uuid: work.uuid });
      setToc(toc);
    })();
  }, [work.uuid]);

  if (!summary || !toc) {
    return <TranslationSkeleton />;
  }

  return (
    <FrontMatterPanel
      summary={summary}
      toc={toc}
      work={work}
      renderTranslation={({ content, name, className }) => (
        <TranslationBuilder
          content={content}
          name={name}
          className={className}
          filter={FRONT_MATTER_FILTER}
        />
      )}
    />
  );
};
