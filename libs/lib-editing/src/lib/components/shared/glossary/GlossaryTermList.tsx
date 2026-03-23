'use client';

import { SectionTitle } from '@design-system';
import { LabeledElement } from '../LabeledElement';
import { GlossaryInstanceBody } from './GlossaryInstanceBody';
import { cn } from '@lib-utils';
import { useGlossaryPagination } from './GlossaryPaginationProvider';

export const GlossaryTermList = ({
  className,
}: {
  className?: string;
}) => {
  const { terms, endIsLoading } = useGlossaryPagination();
  const isNavigationLoading = endIsLoading && terms.length === 0;

  if (isNavigationLoading) return null;

  return (
    <div className={cn('flex flex-col w-full', className)}>
      <LabeledElement
        className="@c/sidebar:mt-5 mt-6"
        id={'glossary'}
        label="g."
      >
        <SectionTitle>Glossary</SectionTitle>
      </LabeledElement>
      <div className="mt-3 flex flex-col gap-6">
        {terms.length === 0 && (
          <div className="text-muted-foreground">No glossary terms found.</div>
        )}
        {terms.map((instance, index) => (
          <LabeledElement
            id={instance.uuid || instance.authority || `glossary-${index}`}
            key={instance.uuid || instance.authority || `glossary-${index}`}
            label={`g.${instance.termNumber}`}
            contentType="glossary"
          >
            <GlossaryInstanceBody
              instance={instance}
              className="p-0 @c/sidebar:-mt-0.5"
            />
          </LabeledElement>
        ))}
      </div>
    </div>
  );
};
