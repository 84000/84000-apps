'use client';

import { DropdownMenuItem, DropdownMenuSeparator } from '@design-system';
import { BracesIcon, PencilIcon, Trash2Icon } from 'lucide-react';

export const EditorOptions = ({
  onSelection,
  type,
}: {
  onSelection: (item: string) => void;
  type?: string;
}) => {
  return (
    <>
      <DropdownMenuItem onSelect={() => onSelection('label')}>
        <PencilIcon className="text-ochre" /> Edit Label
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => onSelection('attributes')}>
        <BracesIcon className="text-ochre" /> View Attributes
      </DropdownMenuItem>
      {type === 'endnotes' && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => onSelection('deleteEndnote')}
            className="text-destructive"
          >
            <Trash2Icon className="text-destructive" /> Delete Endnote
          </DropdownMenuItem>
        </>
      )}
    </>
  );
};
