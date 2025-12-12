'use client';

import { H3, SectionTitle } from '@design-system';
import { LabeledElement } from '../LabeledElement';
import { BibliographyEntries } from '@data-access';
import { cn } from '@lib-utils';
import { useScrollInTab } from '../hooks/useScrollInTab';
import { BibliographyBody } from './BibliographyBody';

export const BibliographyList = ({
  content,
  className,
}: {
  content: BibliographyEntries;
  className?: string;
}) => {
  const { ref } = useScrollInTab({
    panel: 'right',
    tab: 'bibliography',
  });

  return (
    <div ref={ref} className={cn('flex flex-col w-full', className)}>
      <LabeledElement
        className="position-sidebar:mt-5 mt-6"
        id={'bibliography'}
        label="b."
      >
        <SectionTitle>Bibliography</SectionTitle>
      </LabeledElement>
      <div className="mt-3 flex flex-col gap-6">
        {content.length === 0 && (
          <div className="py-16 mx-auto text-muted-foreground">
            No bibliography entries found.
          </div>
        )}
        {content.map((section, i) => (
          <div key={i} className="flex flex-col gap-4">
            {section.heading && (
              <LabeledElement
                className="position-sidebar:mt-3 mt-4"
                id={`${section.heading}-${i}`}
                label={`b.${i + 1}`}
              >
                <H3>{section.heading}</H3>
              </LabeledElement>
            )}
            {section.entries.map((entry, j) => (
              <BibliographyBody
                entry={entry}
                label={`b.${i + 1}.${j + 1}`}
                key={entry.uuid}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
