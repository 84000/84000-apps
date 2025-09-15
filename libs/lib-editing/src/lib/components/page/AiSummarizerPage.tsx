'use client';

import { notFound } from 'next/navigation';
import { useEditorState } from './EditorProvider';

export const AiSummarizerPage = () => {
  const { uuid } = useEditorState();

  const url = process.env.NEXT_PUBLIC_AI_SUMMARIZER_URL;
  if (!url) {
    return notFound();
  }

  const src = `${url}?uuid=${uuid}`;
  return <iframe src={src} className="flex-grow" title="AI Summarizer" />;
};
