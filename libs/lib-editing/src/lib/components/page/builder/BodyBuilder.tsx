'use client';

import { getTranslationBody } from '@data-access';
import { CollaborativeBuilder } from './CollaborativeBuilder';

export const BodyBuilder = () => {
  return (
    <CollaborativeBuilder builder="body" fetchContent={getTranslationBody} />
  );
};
