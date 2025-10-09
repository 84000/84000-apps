'use client';

import { GlossaryTermInstance } from '@data-access';
import { Separator } from '@design-system';
import { cn, removeHtmlTags } from '@lib-utils';
import { useEffect, useState } from 'react';

export const GlossaryInstanceBody = ({
  instance,
  className,
}: {
  instance: GlossaryTermInstance;
  className?: string;
}) => {
  const [definition, setDefinition] = useState<string>();

  useEffect(() => {
    if (!instance?.definition) {
      return;
    }

    const plainText = removeHtmlTags(instance.definition);
    setDefinition(plainText);
  }, [instance.definition, setDefinition]);

  return (
    <div className={cn('p-2 flex gap-1 flex-col', className)}>
      {instance.names.english && (
        <div className="text-xl font-serif font-semibold">
          {instance.names.english}
        </div>
      )}
      {instance.names.wylie && (
        <div className="italic">{instance.names.wylie}</div>
      )}
      {instance.names.tibetan && (
        <div className="text-lg">{instance.names.tibetan}</div>
      )}
      {instance.names.sanskrit && (
        <div className="italic">{instance.names.sanskrit}</div>
      )}
      {instance.names.chinese && <div>{instance.names.chinese}</div>}
      {instance.names.pali && (
        <div className="italic">{instance.names.pali}</div>
      )}
      <Separator className="w-4 h-0.5 my-5 bg-slate/80" />
      {definition && <p>{definition}</p>}
      <div className="text-sm text-mut mt-2">
        <a
          href={`/glossary/${instance.authority}`}
          target="_blank"
          rel="noreferrer"
          className="hover:underline decoration-slate hover:text-slate"
        >
          {'View full entry ›'}
        </a>
      </div>
    </div>
  );
};
