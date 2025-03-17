import {
  createBrowserClient,
  getTranslationByUuid,
  getTranslationUuids,
} from '@data-access';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  H3,
  H4,
  P,
  Title,
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
            {publication?.frontMatter.titles.map((title, index) => (
              <Title key={index} uuid={title.uuid} language={title.language}>
                {title.title}
              </Title>
            ))}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <H3>Imprint</H3>
          {publication?.frontMatter.imprint.map((imprint, index) => (
            <H4 key={index}>{imprint.englishTranslator}</H4>
          ))}
          <H3>Introductions</H3>
          {publication?.frontMatter.introductions.map((introduction, index) => (
            <P key={index}>{introduction.content}</P>
          ))}
          <H3>Body</H3>
          {publication?.body.map((body, index) => (
            <P key={index}>{body.content}</P>
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
