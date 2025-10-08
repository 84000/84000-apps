import { H2, Separator } from '@design-system';
import { LabeledElement } from '../LabeledElement';
import { GlossaryTermInstance } from '@data-access';
import { GlossaryInstanceBody } from './GlossaryInstanceBody';
import { cn } from '@lib-utils';

export const GlossaryTermList = ({
  content,
  className,
}: {
  content: GlossaryTermInstance[];
  className?: string;
}) => {
  return (
    <div className={cn('flex flex-col w-full', className)}>
      <LabeledElement className="mt-8" id={'glossary'} label="g.">
        <H2>Glossary</H2>
      </LabeledElement>
      <div className="mt-4 flex flex-col gap-8">
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
            <div className="mt-8">
              <Separator />
            </div>
          </LabeledElement>
        ))}
      </div>
    </div>
  );
};
