import { DropdownMenuItem, DropdownMenuSeparator } from '@design-system';
import { NodeViewProps } from '@tiptap/react';
import { BookmarkIcon, CopyIcon } from 'lucide-react';
import { useCallback } from 'react';

export const ReaderOptions = (props: NodeViewProps) => {
  const copyLink = useCallback(() => {
    const uuid = props.node.attrs.uuid;
    const url = new URL(window.location.href);
    url.hash = `#${uuid}`;
    navigator.clipboard.writeText(url.toString());
  }, [props.node]);
  return (
    <>
      <DropdownMenuItem disabled>
        <BookmarkIcon className="text-ochre" /> Add Bookmark
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={copyLink}>
        <CopyIcon className="text-ochre" /> Copy Link
      </DropdownMenuItem>
    </>
  );
};
