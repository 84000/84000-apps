import { createBrowserClient, getTranslationsMetadata } from '@data-access';
import { TranslationsTable } from '../../../../components/table/TranslationsTable';
import React from 'react';
import { H2 } from '@design-system';

export const revalidate = 60;

const page = async () => {
  const client = createBrowserClient();
  const works = await getTranslationsMetadata({ client });

  return (
    <div className="flex flex-row justify-center p-4 w-full">
      <div className="sm:max-w-4/5 w-full">
        <H2>{'Translation Editor'}</H2>
        <TranslationsTable works={works} />
      </div>
    </div>
  );
};

export default page;
