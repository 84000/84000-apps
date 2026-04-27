'use client';

import { useCallback } from 'react';
import { NodeViewProps } from '@tiptap/react';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@eightyfourthousand/design-system';
import { BracesIcon, CopyIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import {
  PanelContentType,
  urlForEntity,
} from '@eightyfourthousand/data-access';

export const EditorOptions = ({
  node,
  contentType,
  onSelection,
}: NodeViewProps & {
  contentType: PanelContentType;
  onSelection: (item: string) => void;
}) => {
  const copyLink = useCallback(() => {
    const uuid = node.attrs.uuid;
    const location = window.location;

    const link = urlForEntity({
      location,
      uuid,
      contentType,
    });

    navigator.clipboard.writeText(link);
  }, [node.attrs.uuid, contentType]);

  return (
    <>
      <DropdownMenuItem onSelect={copyLink}>
        <CopyIcon className="text-primary" /> Copy Link
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onSelection('label')}>
        <PencilIcon className="text-Primary" /> Edit Label
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => onSelection('attributes')}>
        <BracesIcon className="text-primary" /> View Attributes
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => onSelection('delete')}
        className="text-destructive"
      >
        <Trash2Icon className="text-destructive" /> Delete
      </DropdownMenuItem>
    </>
  );
};
