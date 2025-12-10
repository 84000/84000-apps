'use client';

import { GlossaryTermInstance } from '@data-access';
import { Li, Ul } from '@design-system';
import { GatedFeature } from '@lib-instr';
import { cn } from '@lib-utils';
import { useRef } from 'react';
import { useGlossaryInstanceListener } from '../hooks/useGlossaryInstanceListener';

export const GlossaryInstanceBody = ({
  instance,
  className,
}: {
  instance: GlossaryTermInstance;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useGlossaryInstanceListener({ ref });

  return (
    <div className={cn('p-2 flex gap-1 flex-col', className)}>
      {instance.names.english && (
        <div className="text-secondary font-sans text-base font-bold">
          {instance.names.english}
        </div>
      )}
      <Ul>
        {instance.names.wylie && (
          <Li className="italic">{instance.names.wylie}</Li>
        )}
        {instance.names.tibetan && (
          <Li className="pt-1">
            <span className="font-tibetan text-base">
              {instance.names.tibetan}
            </span>
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
      {instance.definition && (
        <div
          ref={ref}
          className="glossary-instance-definition"
          dangerouslySetInnerHTML={{ __html: instance.definition }}
        />
      )}
      <GatedFeature flag="authority-pages">
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
      </GatedFeature>
    </div>
  );
};
