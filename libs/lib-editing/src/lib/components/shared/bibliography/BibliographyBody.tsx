'use client';

import { BibliographyEntryItem } from '@eightyfourthousand/data-access';
import { LabeledElement } from '../LabeledElement';
import { useRef } from 'react';
import { useGlossaryInstanceListener } from '../hooks/useGlossaryInstanceListener';
import { removeHtmlTags } from '@eightyfourthousand/lib-utils';

export const BibliographyBody = ({
  entry,
  label,
}: {
  entry: BibliographyEntryItem;
  label: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useGlossaryInstanceListener({ ref });

  const textContent = removeHtmlTags(entry.html);
  const excerpt =
    textContent.slice(0, 100) + (textContent.length > 100 ? '...' : '');

  return (
    <LabeledElement
      id={entry.uuid}
      key={entry.uuid}
      label={label}
      contentType="bibliography"
      excerpt={excerpt}
    >
      <div ref={ref} dangerouslySetInnerHTML={{ __html: entry.html }} />
    </LabeledElement>
  );
};
