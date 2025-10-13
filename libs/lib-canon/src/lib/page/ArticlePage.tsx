'use client';

import Image from 'next/image';
import { CanonDetail } from '@data-access';
import { H2 } from '@design-system';
import { BlockEditor } from '@lib-editing';

export const ArticlePage = ({ section }: { section: CanonDetail }) => {
  const { label, description, article } = section;

  return (
    <>
      <H2 className="text-navy">{label}</H2>
      {article?.body ? (
        <div className="py-4 overflow-y-auto h-full">
          {article.image && (
            <div className="text-center mb-8">
              <div className="relative mb-4 w-full aspect-2/1">
                <Image
                  src={article.image}
                  alt={label}
                  fill={true}
                  objectFit="cover"
                  className="rounded-lg shadow-lg"
                />
              </div>
              {article.caption && (
                <div className="text-sm text-muted-foreground italic mt-2">
                  {article.caption}
                </div>
              )}
            </div>
          )}
          <BlockEditor content={article.body} isEditable={false} />
        </div>
      ) : (
        <div className="py-4">
          <p className="text-gray-600">{description}</p>
          <div className="mt-4 text-muted-foreground italic text-sm">
            <p>Check back later for a full article.</p>
          </div>
        </div>
      )}
    </>
  );
};
