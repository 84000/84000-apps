'use client';

import { PanelContentType, urlForPanelContent } from '@data-access';
import { DropdownMenuItem, DropdownMenuSeparator } from '@design-system';
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
    const hash = props.node.attrs.uuid;
    const contentType = props.contentType;
    const location = window.location;

    const link = urlForPanelContent({
      location,
      hash,
      contentType,
    });

    navigator.clipboard.writeText(link);
  }, [props.node, props.contentType]);
  return (
    <>
      <DropdownMenuItem onSelect={props.toggleBookmark}>
        <BookmarkIcon className="text-ochre" />
        {props.isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={copyLink}>
        <CopyIcon className="text-ochre" /> Copy Link
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
            <MessageSquareIcon className="text-ochre" /> Suggest Revision
          </DropdownMenuItem>
        </>
      )}
    </>
  );
};
