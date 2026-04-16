'use client';

import { SectionTitle } from '@eightyfourthousand/design-system';
import { LabeledElement } from '../LabeledElement';
import { GlossaryInstanceBody } from './GlossaryInstanceBody';
import { cn } from '@eightyfourthousand/lib-utils';
import { useGlossaryPagination } from './GlossaryPaginationProvider';
import { GlossarySkeleton } from './GlossarySkeleton';

const LOADING_SKELETONS_COUNT = 3;

export const GlossaryTermList = ({
  className,
  isEditor = false,
}: {
  className?: string;
  isEditor?: boolean;
}) => {
  const { terms, startCursor, endIsLoading } = useGlossaryPagination();
  const isNavigationLoading = endIsLoading && terms.length === 0;

  if (isNavigationLoading) return null;

  return (
    <div className={cn('flex flex-col w-full', className)}>
      <LabeledElement className="mt-2" id={'glossary'} label="g.">
        <SectionTitle>Glossary</SectionTitle>
      </LabeledElement>
      <div className="mt-3 flex flex-col gap-6">
        {startCursor && (
          <div className="flex flex-col gap-6">
            {Array.from({ length: LOADING_SKELETONS_COUNT }).map((_, i) => (
              <GlossarySkeleton key={i} />
            ))}
          </div>
        )}
        {terms.length === 0 && (
          <div className="text-muted-foreground">No glossary terms found.</div>
        )}
        {terms.map((instance, index) => (
          <LabeledElement
            id={instance.authority || instance.uuid || `glossary-${index}`}
            key={instance.authority || instance.uuid || `glossary-${index}`}
            label={`g.${instance.termNumber}`}
            contentType="glossary"
          >
            <GlossaryInstanceBody
              instance={instance}
              isEditor={isEditor}
              className="p-0 @c/sidebar:-mt-0.5"
            />
          </LabeledElement>
        ))}
      </div>
    </div>
  );
};
