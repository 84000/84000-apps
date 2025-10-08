import {
  createBrowserClient,
  BACK_MATTER_FILTER,
  getTranslationPassages,
  getGlossaryInstances,
  getBibliographyEntries,
} from '@data-access';
import { blocksFromTranslationBody } from '../../block';
import { BodyReader } from '../reader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@design-system';
import { GlossaryTermList } from './glossary';
import { BibliographyList } from './bibliography';

export const ReaderBackMatterPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  const client = createBrowserClient();
  const passages = await getTranslationPassages({
    client,
    uuid: slug,
    type: BACK_MATTER_FILTER,
  });

  const endnotes = blocksFromTranslationBody(
    passages.filter((p) => p.type.startsWith('endnote')),
  );
  const abbreviations = blocksFromTranslationBody(
    passages.filter((p) => p.type.startsWith('abbreviation')),
  );

  const glossary = await getGlossaryInstances({ client, uuid: slug });
  const bibliography = await getBibliographyEntries({ client, uuid: slug });

  return (
    <Tabs
      defaultValue="endnotes"
      className="px-8 pb-[var(--header-height)] max-w-6xl w-full mx-auto mb-[var(--header-height)]"
    >
      <TabsList className="sticky top-2 mx-auto z-10">
        <TabsTrigger value="endnotes">Notes</TabsTrigger>
        <TabsTrigger value="glossary">Glossary</TabsTrigger>
        <TabsTrigger value="bibliography">Biblio</TabsTrigger>
        <TabsTrigger value="abbreviations">Abbreviations</TabsTrigger>
      </TabsList>
      <TabsContent value="endnotes">
        <BodyReader content={endnotes} />
      </TabsContent>
      <TabsContent value="glossary">
        <GlossaryTermList content={glossary} />
      </TabsContent>
      <TabsContent value="bibliography">
        <BibliographyList content={bibliography} />
      </TabsContent>
      <TabsContent value="abbreviations">
        <BodyReader content={abbreviations} />
      </TabsContent>
    </Tabs>
  );
};
