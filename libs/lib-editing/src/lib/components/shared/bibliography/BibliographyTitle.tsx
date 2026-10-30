'use client';

import { SectionTitle } from '@eightyfourthousand/design-system';
import { LabeledElement } from '../LabeledElement';

/** The Bibliography tab's own heading, `b.`, above every section and entry. */
export const BibliographyTitle = ({ className }: { className?: string }) => (
  <LabeledElement
    className={className}
    id="bibliography"
    label="b."
    excerpt="Bibliography"
  >
    <SectionTitle>Bibliography</SectionTitle>
  </LabeledElement>
);
