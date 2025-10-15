'use client';

import { notFound } from 'next/navigation';

export const AiSummarizerPage = () => {
  const src = process.env.NEXT_PUBLIC_AI_SUMMARIZER_URL;
  if (!src) {
    return notFound();
  }

  return <iframe src={src} className="size-full" title="AI Summarizer" />;
};
