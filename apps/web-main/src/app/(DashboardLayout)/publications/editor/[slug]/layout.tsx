import {
  createBrowserClient,
  getTranslationMetadataByUuid,
  getTranslationPassageTypes,
} from '@data-access';
import { EditorContextProvider } from '@lib-editing';

const layout = async ({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) => {
  const { slug } = await params;

  const client = createBrowserClient();
  const builders = await getTranslationPassageTypes({
    client,
    uuid: slug,
  });
  const work = await getTranslationMetadataByUuid({
    client,
    uuid: slug,
  });

  return (
    <EditorContextProvider uuid={slug} work={work} builders={builders}>
      {children}
    </EditorContextProvider>
  );
};

export default layout;
