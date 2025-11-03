import { DropdownMenuItem, DropdownMenuSeparator } from '@design-system';
import { BracesIcon, PencilIcon } from 'lucide-react';

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
    </>
  );
};
