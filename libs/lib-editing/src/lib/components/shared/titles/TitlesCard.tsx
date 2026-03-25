'use client';

import { PencilIcon } from 'lucide-react';
import { Button, Vajrasattva } from '@84000/design-system';
import { cn } from '@84000/lib-utils';

export const TitlesCard = ({
  header = '',
  main = '',
  footer = '',
  toh = '',
  section = '',
  authors = [],
  attribution = 'by',
  authorsJoiner = ',',
  canEdit = false,
  onEdit,
}: {
  header?: string;
  main?: string;
  footer?: string;
  toh?: string;
  section?: string;
  authors?: string[];
  attribution?: string;
  authorsJoiner?: string;
  canEdit?: boolean;
  onEdit?(): void;
}) => {
  const radial =
    'bg-radial-[at_50%_50%] from-ochre-25 from-35% to-navy-25';

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-1.5 rounded-lg border bg-background p-1.5">
      {(toh || section) && (
        <div
          className={cn(
            'hidden w-32 flex-col justify-center gap-4 rounded-s-lg border p-2 text-center md:flex',
            radial,
          )}
        >
          <span className="text-sm leading-4 font-light text-ochre-700">
            {section}
          </span>
          <span className="text-xs uppercase text-muted-foreground">{toh}</span>
        </div>
      )}
      <div className="grow min-w-0 flex flex-col justify-center gap-3 rounded-lg border px-2 py-4 text-center md:rounded-s-none md:rounded-e-lg lg:rounded-none">
        {header && (
          <div
            className={cn(
              'font-tibetan text-navy-500 px-2',
              main ? 'text-2xl' : 'text-3xl',
              'leading-relaxed break-all xs:break-normal',
            )}
          >
            {header}
          </div>
        )}
        {main && (
          <div className="title-main break-all px-2 font-serif text-3xl text-navy-500 xs:break-normal">
            {main}
          </div>
        )}
        <div className="flex justify-between gap-2 px-2">
          {canEdit && <div className="w-1/8" />}
          {footer && (
            <span className="title-sub long-term flex-grow font-serif text-2xl font-light italic text-muted-foreground">
              {footer}
            </span>
          )}
          {canEdit && (
            <div className="w-1/8 flex justify-end gap-1">
              <Button
                className="size-7 rounded-lg text-muted-foreground"
                size="icon"
                variant="outline"
                aria-label="Edit titles"
                onClick={onEdit}
              >
                <PencilIcon />
              </Button>
            </div>
          )}
        </div>
        {authors.length > 0 && (
          <div className="title-sub font-serif">
            <div className="py-2 text-xs uppercase text-muted-foreground">
              {attribution}
            </div>
            <div className="-mt-2 mx-auto flex flex-wrap justify-center gap-x-2 text-xl text-secondary">
              {authors.map((author, idx) => (
                <div key={`author-wrapper-${idx}`} className="flex">
                  <span key={`${author}-${idx}`} className="italic">
                    {author}
                  </span>
                  {idx < authors.length - 1 && (
                    <span key={`comma-${idx}`} className="whitespace-pre">
                      {authorsJoiner}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={cn('hidden w-32 rounded-e-lg border lg:flex', radial)}>
        <Vajrasattva className="size-full object-contain opacity-40 mix-blend-multiply" />
      </div>
    </div>
  );
};
