import { H2, H3 } from '@design-system';
import { LabeledElement } from '../LabeledElement';
import { BibliographyEntries } from '@data-access';
import { cn } from '@lib-utils';

export const BibliographyList = ({
  content,
  className,
}: {
  content: BibliographyEntries;
  className?: string;
}) => {
  return (
    <div className={cn('flex flex-col w-full', className)}>
      <LabeledElement className="mt-8" id={'bibliography'} label="b.">
        <H2>Bibliography</H2>
      </LabeledElement>
      <div className="mt-4 flex flex-col gap-8">
        {content.length === 0 && (
          <div className="py-16 mx-auto text-muted-foreground">
            No bibliography entries found.
          </div>
        )}
        {content.map((section, i) => (
          <div key={i} className="flex flex-col gap-4">
            {section.heading && (
              <LabeledElement
                className="mt-6"
                id={`${section.heading}-${i}`}
                label={`b.${i + 1}`}
              >
                <H3>{section.heading}</H3>
              </LabeledElement>
            )}
            {section.entries.map((entry, j) => (
              <LabeledElement
                id={entry.uuid}
                key={entry.uuid}
                label={`b.${i + 1}.${j + 1}`}
              >
                <div dangerouslySetInnerHTML={{ __html: entry.html }} />
              </LabeledElement>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
