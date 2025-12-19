'use client';

import { PanelContentType, urlForPanelContent } from '@data-access';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@design-system';
import { cn } from '@lib-utils';
import { CopyIcon } from 'lucide-react';
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
          <DropdownMenuTrigger
            className={cn(
              'absolute labeled -left-16 w-16 text-end hover:cursor-pointer whitespace-pre-line leading-4',
              className,
            )}
          >
            {label || ''}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" alignOffset={48} className="w-64">
            {/* <DropdownMenuItem disabled> */}
            {/*   <BookmarkIcon className="text-ochre" /> Add Bookmark */}
            {/* </DropdownMenuItem> */}
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
