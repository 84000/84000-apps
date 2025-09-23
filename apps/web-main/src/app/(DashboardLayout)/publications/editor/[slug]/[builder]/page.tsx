'use client';

import type { EditorBuilderType } from '@lib-editing';
import { CollaborativeBuilder } from '@lib-editing';
import type { BodyItemType, DataClient } from '@data-access';
import { getTranslationPassages } from '@data-access';
import { useParams } from 'next/navigation';

const Page = () => {
  const params = useParams();
  const builder = params.builder as EditorBuilderType;
  const fetchContent = async ({
    client,
    uuid,
  }: {
    client: DataClient;
    uuid: string;
  }) => {
    const type = builder as BodyItemType;
    return await getTranslationPassages({ client, uuid, type });
  };

  return <CollaborativeBuilder builder={builder} fetchContent={fetchContent} />;
};

export default Page;
