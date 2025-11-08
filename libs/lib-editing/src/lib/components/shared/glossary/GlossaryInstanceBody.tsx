'use client';

import { GlossaryTermInstance } from '@data-access';
import { Li, Ul } from '@design-system';
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
      <Ul>
        {instance.names.wylie && (
          <Li className="italic">{instance.names.wylie}</Li>
        )}
        {instance.names.tibetan && (
          <Li>
            <span className="text-lg">{instance.names.tibetan}</span>
          </Li>
        )}
        {instance.names.sanskrit && (
          <Li className="italic">{instance.names.sanskrit}</Li>
        )}
        {instance.names.chinese && <Li>{instance.names.chinese}</Li>}
        {instance.names.pali && (
          <Li className="italic">{instance.names.pali}</Li>
        )}
      </Ul>
      <div className="my-2" />
      {definition && <p>{definition}</p>}
      <div className="text-sm text-mut my-2">
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
