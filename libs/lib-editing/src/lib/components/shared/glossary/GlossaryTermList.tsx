'use client';

import { SectionTitle } from '@design-system';
import { LabeledElement } from '../LabeledElement';
import { GlossaryTermInstances } from '@data-access';
import { GlossaryInstanceBody } from './GlossaryInstanceBody';
import { cn } from '@lib-utils';
import { useScrollInTab } from '../hooks/useScrollInTab';

export const GlossaryTermList = ({
  content,
  className,
}: {
  content: GlossaryTermInstances;
  className?: string;
}) => {
  const { ref } = useScrollInTab({
    panel: 'right',
    tab: 'glossary',
  });

  return (
    <div ref={ref} className={cn('flex flex-col w-full', className)}>
      <LabeledElement
        className="position-sidebar:mt-5 mt-6"
        id={'glossary'}
        label="g."
        contentType="glossary"
      >
        <SectionTitle>Glossary</SectionTitle>
      </LabeledElement>
      <div className="mt-3 flex flex-col gap-6">
        {content.length === 0 && (
          <div className="text-muted-foreground">No glossary terms found.</div>
        )}
        {content.map((instance, index) => (
          <LabeledElement
            id={instance.uuid || instance.authority || `glossary-${index}`}
            key={instance.uuid || instance.authority || `glossary-${index}`}
            label={`g.${index + 1}`}
            contentType="glossary"
          >
            <GlossaryInstanceBody
              instance={instance}
              className="p-0 position-sidebar:-mt-0.5"
            />
          </LabeledElement>
        ))}
      </div>
    </div>
  );
};
