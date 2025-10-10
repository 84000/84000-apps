import { H2 } from '@design-system';
import { LabeledElement } from '../LabeledElement';
import { GlossaryTermInstances } from '@data-access';
import { GlossaryInstanceBody } from './GlossaryInstanceBody';
import { cn } from '@lib-utils';

export const GlossaryTermList = ({
  content,
  className,
}: {
  content: GlossaryTermInstances;
  className?: string;
}) => {
  return (
    <div className={cn('flex flex-col w-full', className)}>
      <LabeledElement
        className="position-sidebar:mt-3.5 mt-6"
        id={'glossary'}
        label="g."
      >
        <H2>Glossary</H2>
      </LabeledElement>
      <div className="mt-3 flex flex-col gap-6">
        {content.length === 0 && (
          <div className="text-muted-foreground">No glossary terms found.</div>
        )}
        {content.map((instance, index) => (
          <LabeledElement
            id={instance.uuid}
            key={instance.uuid}
            label={`g.${index + 1}`}
          >
            <GlossaryInstanceBody instance={instance} className="p-0" />
          </LabeledElement>
        ))}
      </div>
    </div>
  );
};
