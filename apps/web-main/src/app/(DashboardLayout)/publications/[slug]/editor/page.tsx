import {
  createBrowserClient,
  getTranslationByUuid,
  getTranslationUuids,
} from '@data-access';
import {
  Blockquote,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  H1,
  H2,
  H3,
  H4,
  P,
} from '@design-system';
import { notFound } from 'next/navigation';
import React from 'react';

export const revalidate = 60;
export const dynamicParams = true;

const page = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const client = createBrowserClient();
  const publication = await getTranslationByUuid({ client, uuid: slug });

  if (!publication) {
    return notFound();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <H1>{publication?.frontMatter.toh}</H1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <H2>Titles</H2>
          {publication?.frontMatter.titles.map((title, index) => (
            <H4 key={index}>
              {title.title} ({title.language})
            </H4>
          ))}
          <H2>Imprint</H2>
          {publication?.frontMatter.imprint.map((imprint, index) => (
            <H3 key={index}>{imprint.englishTranslator}</H3>
          ))}
          <H2>Introductions</H2>
          {publication?.frontMatter.introductions.map((introduction, index) => (
            <P key={index}>{introduction.content}</P>
          ))}
          <H2>Body</H2>
          {publication?.body.map((body, index) => (
            <P key={index}>{body.content}</P>
          ))}
          <H2>Notes</H2>
          {publication?.backMatter.endNotes?.map((note, index) => (
            <P key={index}>{note.content}</P>
          ))}
          <H2>Bibliography</H2>
          {publication?.backMatter.bibliography?.map((bibliography, index) => (
            <Blockquote key={index}>
              {bibliography.title} {bibliography.publisher}
            </Blockquote>
          ))}
          <H2>Glossary</H2>
          {publication?.backMatter.glossary?.map((glossary, index) => (
            <div key={index}>
              {glossary.names.map((name, index2) => (
                <H4 key={`${index}-${index2}`}>{name.content}</H4>
              ))}
              {glossary.definition && <P>{glossary.definition}</P>}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
};

export const generateStaticParams = async () => {
  const client = createBrowserClient();
  const slugs = await getTranslationUuids({ client });
  return slugs.map((slug) => ({ slug }));
};

export default page;
