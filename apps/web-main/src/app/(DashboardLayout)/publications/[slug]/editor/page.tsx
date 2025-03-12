import {
  createBrowserClient,
  getTranslationByUuid,
  getTranslationUuids,
} from '@data-access';
import { Card, CardContent, CardHeader, CardTitle } from '@design-system';
import { notFound } from 'next/navigation';
import React from 'react';

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
        <CardTitle>{publication?.frontMatter.toh}</CardTitle>
        <CardContent>
          <CardHeader className="pt-4 pb-2">Titles</CardHeader>
          {publication?.frontMatter.titles.map((title, index) => (
            <div key={index} className="py-2">
              <h2>
                {title.title} ({title.language})
              </h2>
            </div>
          ))}
          <CardHeader className="pt-4 pb-2">Imprint</CardHeader>
          {publication?.frontMatter.imprint.map((imprint, index) => (
            <div key={index} className="py-2">
              <h2>{imprint.englishTranslator}</h2>
            </div>
          ))}
          <CardHeader className="pt-4 pb-2">Introductions</CardHeader>
          {publication?.frontMatter.introductions.map((introduction, index) => (
            <div key={index} className="py-2">
              <h2>{introduction.content}</h2>
            </div>
          ))}
          <CardHeader className="pt-4 pb-2">Body</CardHeader>
          {publication?.body.map((body, index) => (
            <div key={index} className="py-2">
              <h2>{body.content}</h2>
            </div>
          ))}
          <CardHeader className="pt-4 pb-2">Notes</CardHeader>
          {publication?.backMatter.endNotes?.map((note, index) => (
            <div key={index} className="py-2">
              <h2>{note.content}</h2>
            </div>
          ))}
          <CardHeader className="pt-4 pb-2">Bibliography</CardHeader>
          {publication?.backMatter.bibliography?.map((bibliography, index) => (
            <div key={index} className="py-2">
              <h2>
                {bibliography.title} {bibliography.publisher}
              </h2>
            </div>
          ))}
          <CardHeader className="pt-4 pb-2">Glossary</CardHeader>
          {publication?.backMatter.glossary?.map((glossary, index) => (
            <div key={index} className="py-2">
              {glossary.names.map((name, index2) => (
                <div key={`${index}-${index2}`} className="py-2">
                  <h2>{name.content}</h2>
                </div>
              ))}
              {glossary.definition && (
                <p className={`py-2`}>{glossary.definition}</p>
              )}
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
