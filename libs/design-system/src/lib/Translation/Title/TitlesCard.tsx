import { PencilIcon, PlusIcon } from 'lucide-react';
import { Button } from '../../Button/Button';
import { FramedCard } from './FramedCard';

export const TitlesCard = ({
  header = '',
  main,
  footer = '',
  canEdit = false,
  hasMore = true,
  onEdit,
  onMore,
}: {
  header?: string;
  main: string;
  footer?: string;
  canEdit?: boolean;
  hasMore?: boolean;
  onEdit?(): void;
  onMore?(): void;
}) => {
  return (
    <FramedCard className="max-w-xl mx-auto">
      <div className="flex flex-col gap-3 py-6 px-2">
        <div className="min-h-10 pb-3 border-b border-navy-50 font-sans font-light text-xl text-navy-200 text-center line-clamp-1">
          {header}
        </div>
        <div className="font-serif font-medium text-2xl text-navy-500 text-center line-clamp-2 leading-10">
          {main}
        </div>
        <div className="min-h-10 pt-3 border-t border-navy-50 flex justify-between gap-2">
          <div className="w-1/3" />
          <span className="w-1/3 font-sans font-extrabold text-xl text-ochre-500 text-center line-clamp-1">
            {footer}
          </span>
          <div className="w-1/3 flex gap-1 justify-end">
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
            {hasMore && (
              <Button
                className="rounded-lg size-7 text-muted-foreground"
                size="icon"
                variant="outline"
                aria-label="All titles"
                onClick={onMore}
              >
                <PlusIcon />
              </Button>
            )}
          </div>
        </div>
      </div>
    </FramedCard>
  );
};
