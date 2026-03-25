'use client';

import { DropdownMenuItem, DropdownMenuSeparator } from '@eightyfourthousand/design-system';
import { BracesIcon, PencilIcon, Trash2Icon } from 'lucide-react';

export const EditorOptions = ({
  onSelection,
}: {
  onSelection: (item: string) => void;
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
