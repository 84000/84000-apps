'use client';

import { getTranslationEndnotes } from '@data-access';
import { CollaborativeBuilder } from './CollaborativeBuilder';

export const EndnoteBuilder = () => {
  return (
    <CollaborativeBuilder
      builder="end-notes"
      fetchContent={getTranslationEndnotes}
    />
  );
};
