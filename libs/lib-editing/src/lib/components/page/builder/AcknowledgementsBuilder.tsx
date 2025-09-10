'use client';

import { getTranslationAcknowledgements } from '@data-access';
import { CollaborativeBuilder } from './CollaborativeBuilder';

export const AcknowledgementBuilder = () => {
  return (
    <CollaborativeBuilder
      fetchContent={getTranslationAcknowledgements}
      builder="acknowledgements"
    />
  );
};
