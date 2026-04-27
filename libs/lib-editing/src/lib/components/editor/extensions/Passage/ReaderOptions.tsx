'use client';

import {
  PanelContentType,
  urlForEntity,
} from '@eightyfourthousand/data-access';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@eightyfourthousand/design-system';
import { NodeViewProps } from '@tiptap/react';
import { BookmarkIcon, CopyIcon, MessageSquareIcon } from 'lucide-react';
import { useCallback } from 'react';

export const ReaderOptions = (
  props: NodeViewProps & {
    contentType: PanelContentType;
    isBookmarked?: boolean;
    toggleBookmark?: () => void;
    onSuggestRevision?: () => void;
  },
) => {
  const copyLink = useCallback(() => {
    const uuid = props.node.attrs.uuid;
    const contentType = props.contentType;
    const location = window.location;

    const link = urlForEntity({
      location,
      uuid,
      contentType,
    });

    navigator.clipboard.writeText(link);
  }, [props.node.attrs.uuid, props.contentType]);

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
