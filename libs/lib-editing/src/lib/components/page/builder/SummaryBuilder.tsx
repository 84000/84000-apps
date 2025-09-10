'use client';

import { getTranslationSummary } from '@data-access';
import { CollaborativeBuilder } from './CollaborativeBuilder';

export const SummaryBuilder = () => {
  return (
    <CollaborativeBuilder
      builder="summary"
      fetchContent={getTranslationSummary}
    />
  );
};
