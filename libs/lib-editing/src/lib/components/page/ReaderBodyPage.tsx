import {
  BODY_MATTER_FILTER,
  createBrowserClient,
  getTranslationPassages,
  getTranslationTitles,
} from '@data-access';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Titles,
} from '@design-system';
import { BodyReader } from '../reader';
import { blocksFromTranslationBody } from '../../block';

export const ReaderBodyPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  const client = createBrowserClient();
  const passages = await getTranslationPassages({
    client,
    uuid: slug,
    type: BODY_MATTER_FILTER,
  });
  const titles = await getTranslationTitles({ client, uuid: slug });
  const mainTitles = titles.filter((t) => t.type === 'mainTitle');
  const body = blocksFromTranslationBody(passages);

  return (
    <Tabs defaultValue="translation" className="px-8">
      <TabsList className="sticky top-2 mx-auto -mt-10 z-10">
        <TabsTrigger value="translation">Translation</TabsTrigger>
        <TabsTrigger value="source">Source</TabsTrigger>
        <TabsTrigger value="compare">Compare</TabsTrigger>
      </TabsList>
      <TabsContent value="translation" className="max-w-6xl w-full">
        <div className="w-full">
          <div className="ms-12">
            <Titles titles={mainTitles} />
          </div>
          <BodyReader content={body} />
        </div>
      </TabsContent>
      <TabsContent value="source">Source text coming soon...</TabsContent>
      <TabsContent value="compare">
        Language comparison coming soon...
      </TabsContent>
    </Tabs>
  );
};
