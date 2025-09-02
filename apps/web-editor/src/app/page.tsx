'use client';

import { TranslationEditor } from '@design-system';
import { content } from '@lib-editing/fixtures/basic/json';

const Page = () => {
  return <TranslationEditor content={content} />;
};

export default Page;
