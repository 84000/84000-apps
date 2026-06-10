'use client';

import {
  PanelContentType,
  urlForEntity,
} from '@eightyfourthousand/data-access';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@eightyfourthousand/design-system';
import { BookmarkIcon, CopyIcon, MessageSquareIcon } from 'lucide-react';
import { useCallback } from 'react';

export const ReaderOptions = (props: {
  uuid: string;
  contentType: PanelContentType;
  isBookmarked?: boolean;
  toggleBookmark?: () => void;
  onSuggestRevision?: () => void;
}) => {
  const copyLink = useCallback(() => {
    const link = urlForEntity({
      location: window.location,
      uuid: props.uuid,
      contentType: props.contentType,
    });

    navigator.clipboard.writeText(link);
  }, [props.uuid, props.contentType]);

  return (
    <>
      <DropdownMenuItem onSelect={props.toggleBookmark}>
        <BookmarkIcon className="text-primary" />
        {props.isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={copyLink}>
        <CopyIcon className="text-primary" /> Copy Link
      </DropdownMenuItem>
      {props.onSuggestRevision && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              props.onSuggestRevision?.();
            }}
          >
            <MessageSquareIcon className="text-primary" /> Suggest Revision
          </DropdownMenuItem>
        </>
      )}
    </>
  );
};
