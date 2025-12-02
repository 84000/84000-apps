'use client';

import { BibliographyEntryItem } from '@data-access';
import { LabeledElement } from '../LabeledElement';
import { useRef } from 'react';
import { useGlossaryInstanceListener } from '../hooks/useGlossaryInstanceListener';

export const BibliographyBody = ({
  entry,
  label,
}: {
  entry: BibliographyEntryItem;
  label: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useGlossaryInstanceListener({ ref });

  return (
    <LabeledElement id={entry.uuid} key={entry.uuid} label={label}>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: entry.html }} />
    </LabeledElement>
  );
};
