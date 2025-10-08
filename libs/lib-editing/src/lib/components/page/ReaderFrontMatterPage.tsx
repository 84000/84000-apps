import {
  createBrowserClient,
  FRONT_MATTER_FILTER,
  getTranslationPassages,
} from '@data-access';
import { blocksFromTranslationBody } from '../../block';
import { BodyReader } from '../reader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';

export const ReaderFrontMatterPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  const client = createBrowserClient();
  const passages = await getTranslationPassages({
    client,
    uuid: slug,
    type: FRONT_MATTER_FILTER,
  });
  const summary = blocksFromTranslationBody(passages);

  return (
    <Tabs defaultValue="toc" className="px-8">
      <TabsList className="sticky top-2 mx-auto z-10">
        <TabsTrigger value="toc">Navigation</TabsTrigger>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="imprint">Imprint</TabsTrigger>
      </TabsList>
      <TabsContent value="toc">Table of Contents coming soon...</TabsContent>
      <TabsContent value="summary" className="max-w-6xl w-full mx-auto">
        <BodyReader content={summary} />
      </TabsContent>
      <TabsContent value="imprint">Imprint coming soon...</TabsContent>
    </Tabs>
  );
};
