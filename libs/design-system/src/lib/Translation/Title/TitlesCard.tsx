import { PencilIcon } from 'lucide-react';
import { Button } from '../../Button/Button';
import { cn } from '@lib-utils';
import { Vajrasattva } from '../../Vajrasattva/Vajrasattva';

export const TitlesCard = ({
  header = '',
  main = '',
  footer = '',
  toh = '',
  section = '',
  canEdit = false,
  onEdit,
}: {
  header?: string;
  main?: string;
  footer?: string;
  toh?: string;
  section?: string;
  canEdit?: boolean;
  onEdit?(): void;
}) => {
  const RADIAL = 'bg-radial-[at_50%_50%] from-ochre-25 from-35% to-navy-25';

  return (
    <div className="p-1.5 max-w-6xl w-full mx-auto border rounded-lg bg-background flex gap-1.5">
      {(toh || section) && (
        <div
          className={cn(
            'w-32 hidden md:flex flex-col gap-4 p-2 justify-center text-center border rounded-s-lg',
            RADIAL,
          )}
        >
          <span className="font-light text-sm leading-4 text-ochre-700">
            {section}
          </span>
          <span className="uppercase text-xs text-muted-foreground">{toh}</span>
        </div>
      )}
      <div className="grow flex flex-col justify-center gap-3 py-4 px-2 border md:rounded-e-lg md:rounded-s-none lg:rounded-none rounded-lg text-center">
        {header && (
          <div
            className={cn(
              'font-tibetan text-navy-500 px-2',
              main ? 'text-2xl' : 'text-3xl',
            )}
          >
            {header}
          </div>
        )}
        {main && (
          <div className="font-serif text-3xl text-navy-500 title-main px-2">
            {main}
          </div>
        )}
        <div className="flex justify-between gap-2 px-2">
          {canEdit && <div className="w-1/8" />}
          {footer && (
            <span className="flex-grow font-serif font-light text-2xl text-muted-foreground italic title-sub">
              {footer}
            </span>
          )}
          {canEdit && (
            <div className="w-1/8 flex gap-1 justify-end">
              {canEdit && (
                <Button
                  className="rounded-lg size-7 text-muted-foreground"
                  size="icon"
                  variant="outline"
                  aria-label="Edit titles"
                  onClick={onEdit}
                >
                  <PencilIcon />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className={cn('w-32 hidden lg:flex border rounded-e-lg', RADIAL)}>
        <Vajrasattva className="mix-blend-multiply opacity-40 object-contain size-full" />
      </div>
    </div>
  );
};
