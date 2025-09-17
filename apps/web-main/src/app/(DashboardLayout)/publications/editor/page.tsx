import { createBrowserClient, getTranslationsMetadata } from '@data-access';
import { TranslationsTable } from '@lib-editing';
import React from 'react';
import { H2 } from '@design-system';

export const revalidate = 60;

const page = async () => {
  const client = createBrowserClient();
  const works = await getTranslationsMetadata({ client });

  return (
    <div className="flex flex-row justify-center pt-0 pb-8 px-4 w-full">
      <div className="w-full max-w-[1466px]">
        <H2 className="text-navy-500">{'Translation Editor'}</H2>
        <TranslationsTable works={works} />
        <div className="h-[var(--header-height)]" />
      </div>
    </div>
  );
};

export default page;
