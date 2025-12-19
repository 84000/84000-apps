'use client';

import { PanelContentType, urlForPanelContent } from '@data-access';
import { DropdownMenuItem } from '@design-system';
import { NodeViewProps } from '@tiptap/react';
import { CopyIcon } from 'lucide-react';
import { useCallback } from 'react';

export const ReaderOptions = (
  props: NodeViewProps & { contentType: PanelContentType },
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
      {/* <DropdownMenuItem disabled> */}
      {/*   <BookmarkIcon className="text-ochre" /> Add Bookmark */}
      {/* </DropdownMenuItem> */}
      {/* <DropdownMenuSeparator /> */}
      <DropdownMenuItem onSelect={copyLink}>
        <CopyIcon className="text-ochre" /> Copy Link
      </DropdownMenuItem>
    </>
  );
};
