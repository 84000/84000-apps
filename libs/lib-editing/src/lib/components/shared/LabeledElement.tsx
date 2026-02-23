'use client';

import {
  PanelContentType,
  urlForPanelContent,
  useBookmark,
} from '@data-access';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@design-system';
import { cn } from '@lib-utils';
import { BookmarkIcon, CopyIcon } from 'lucide-react';
import { ReactNode, useCallback } from 'react';

export const LabeledElement = ({
  label,
  id = undefined,
  className,
  contentType,
  children,
}: {
  label?: string;
  id?: string;
  className?: string;
  contentType?: PanelContentType;
  children: ReactNode;
}) => {
  const { isBookmarked, toggle } = useBookmark(id ?? '', {
    type: contentType ?? '',
    tab: contentType ?? '',
  });

  const copyLink = useCallback(() => {
    if (!id) {
      return;
    }

    const link = urlForPanelContent({
      location: window.location,
      hash: id,
      contentType,
    });
    navigator.clipboard.writeText(link);
  }, [id, contentType]);

  return (
    <div id={id} className="relative scroll-mt-20">
      {id ? (
        <DropdownMenu>
          {isBookmarked && (
            <div className="absolute -left-15.75 top-5 w-16 flex justify-end">
              <BookmarkIcon
                className="text-accent size-3"
                fill="currentColor"
              />
            </div>
          )}
          <DropdownMenuTrigger
            className={cn(
              'absolute labeled -left-16 w-16 text-end hover:cursor-pointer whitespace-pre-line leading-4',
              className,
            )}
          >
            {label || ''}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" alignOffset={48} className="w-64">
            <DropdownMenuItem onSelect={toggle}>
              <BookmarkIcon className="text-ochre" />
              {isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={copyLink}>
              <CopyIcon className="text-ochre" /> Copy Link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div
          className={cn(
            'absolute labeled -left-16 w-16 text-end  whitespace-pre-line leading-4',
            className,
          )}
        >
          {label || ''}
        </div>
      )}
      <div className="passage pl-6 @c/sidebar:pl-4">{children}</div>
    </div>
  );
};
