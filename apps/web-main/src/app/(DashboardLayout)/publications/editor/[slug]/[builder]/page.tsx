'use client';

import { CollaborativeBuilder } from '@lib-editing';
import type { BodyItemType, DataClient } from '@data-access';
import { getTranslationPassages, BODY_ITEM_TYPES } from '@data-access';
import { notFound, useParams } from 'next/navigation';

const Page = () => {
  const params = useParams();
  const builder = params.builder as BodyItemType;

  if (!BODY_ITEM_TYPES.includes(builder)) {
    return notFound();
  }

  const fetchContent = async ({
    client,
    uuid,
  }: {
    client: DataClient;
    uuid: string;
  }) => {
    return await getTranslationPassages({ client, uuid, type: builder });
  };

  return <CollaborativeBuilder builder={builder} fetchContent={fetchContent} />;
};

export default Page;
