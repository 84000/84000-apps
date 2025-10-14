'use client';

import {
  BODY_MATTER_FILTER,
  createBrowserClient,
  getTranslationPassages,
  getTranslationTitles,
  Title,
} from '@data-access';
import { BodyPanel } from './BodyPanel';
import { blocksFromTranslationBody } from '../../block';
import { useEditorState } from './EditorProvider';
import { useEffect, useState } from 'react';
import { TranslationBuilder, TranslationEditorContent } from '../editor';
import { TranslationSkeleton } from './TranslationSkeleton';

export const EditorBodyPage = () => {
  const { work } = useEditorState();
  const [body, setBody] = useState<TranslationEditorContent>();
  const [titles, setTitles] = useState<Title[]>();

  useEffect(() => {
    (async () => {
      const client = createBrowserClient();
      const passages = await getTranslationPassages({
        client,
        uuid: work.uuid,
        type: BODY_MATTER_FILTER,
      });
      const body = blocksFromTranslationBody(passages);
      setBody(body);

      const titles = await getTranslationTitles({ client, uuid: work.uuid });
      setTitles(titles);
    })();
  }, [work.uuid]);

  if (!titles || !body) {
    return <TranslationSkeleton />;
  }

  return (
    <BodyPanel
      titles={titles}
      body={body}
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
