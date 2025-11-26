'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@design-system';
import { cn } from '@lib-utils';
import { BookmarkIcon, CopyIcon } from 'lucide-react';
import { ReactNode, useCallback } from 'react';

export const LabeledElement = ({
  label,
  id = undefined,
  className,
  children,
}: {
  label?: string;
  id?: string;
  className?: string;
  children: ReactNode;
}) => {
  const copyLink = useCallback(() => {
    const url = new URL(window.location.href);
    url.hash = `#${id}`;
    navigator.clipboard.writeText(url.toString());
  }, [id]);

  return (
    <div id={id} className="relative scroll-mt-20">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'absolute labeled -left-16 w-16 text-end hover:cursor-pointer',
            className,
          )}
        >
          {label || ''}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" alignOffset={48} className="w-64">
          <DropdownMenuItem disabled>
            <BookmarkIcon className="text-ochre" /> Add Bookmark
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={copyLink}>
            <CopyIcon className="text-ochre" /> Copy Link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="passage pl-6">{children}</div>
    </div>
  );
};
