'use client';

import type { GlossaryTermInstance } from '@eightyfourthousand/data-access';
import { Li, Ul } from '@eightyfourthousand/design-system';
import { GatedFeature } from '@eightyfourthousand/lib-instr';
import { cn } from '@eightyfourthousand/lib-utils';
import { useRef } from 'react';
import { useGlossaryInstanceListener } from '../hooks/useGlossaryInstanceListener';
import { GlossaryPassagesLink } from './GlossaryPassagesLink';

export const GlossaryInstanceBody = ({
  instance,
  className,
  isEditor = false,
  showPassages = false,
}: {
  instance: GlossaryTermInstance;
  className?: string;
  isEditor?: boolean;
  /** Show the "Passages ›" link that opens the entry's passages dialog. */
  showPassages?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useGlossaryInstanceListener({ ref });

  return (
    <div className={cn('p-2 flex gap-1 flex-col', className)}>
      {instance.names.english && (
        <div className="text-primary font-sans text-base font-bold">
          {instance.names.english}
        </div>
      )}
      {isEditor && instance.names.alternatives && (
        <div className="text-sm text-accent">
          {`Also: ${instance.names.alternatives}`}
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
      {showPassages && (
        <GlossaryPassagesLink
          uuid={instance.uuid}
          english={instance.names.english}
        />
      )}
      <GatedFeature flag="authority-pages">
        <div className="text-sm text-mut my-2">
          <a
            href={`/glossary/${instance.authority}`}
            target="_blank"
            rel="noreferrer"
            className="hover:underline decoration-primary hover:text-primary"
          >
            {'View full entry ›'}
          </a>
        </div>
      </GatedFeature>
    </div>
  );
};
