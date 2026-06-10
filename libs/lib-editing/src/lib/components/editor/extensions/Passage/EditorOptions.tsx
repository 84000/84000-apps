'use client';

import { useCallback } from 'react';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@eightyfourthousand/design-system';
import { BracesIcon, CopyIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import {
  PanelContentType,
  urlForPanelContent,
} from '@eightyfourthousand/data-access';

export const EditorOptions = ({
  uuid,
  contentType,
  onSelection,
}: {
  uuid: string;
  contentType: PanelContentType;
  onSelection: (item: string) => void;
}) => {
  const copyLink = useCallback(() => {
    const link = urlForPanelContent({
      location: window.location,
      hash: uuid,
      contentType,
    });

    navigator.clipboard.writeText(link);
  }, [uuid, contentType]);

  return (
    <>
      <DropdownMenuItem onSelect={copyLink}>
        <CopyIcon className="text-primary" /> Copy Link
      </DropdownMenuItem>
      <DropdownMenuSeparator />
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
