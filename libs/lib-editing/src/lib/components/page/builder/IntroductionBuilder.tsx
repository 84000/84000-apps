'use client';

import { getTranslationIntroduction } from '@data-access';
import { CollaborativeBuilder } from './CollaborativeBuilder';

export const IntroductionBuilder = () => {
  return (
    <CollaborativeBuilder
      builder="introduction"
      fetchContent={getTranslationIntroduction}
    />
  );
};
