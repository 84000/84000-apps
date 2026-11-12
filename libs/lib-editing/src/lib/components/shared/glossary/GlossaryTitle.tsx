'use client';

import { SectionTitle } from '@eightyfourthousand/design-system';
import { LabeledElement } from '../LabeledElement';

/** The Glossary tab's own heading, `g.`, above every entry. */
export const GlossaryTitle = ({ className }: { className?: string }) => (
  <LabeledElement
    className={className}
    id="glossary"
    label="g."
    excerpt="Glossary"
  >
    <SectionTitle>Glossary</SectionTitle>
  </LabeledElement>
);
