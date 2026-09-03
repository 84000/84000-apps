'use client';

import {
  Button,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@eightyfourthousand/design-system';
import { ChangeEvent, useCallback, useState } from 'react';

/**
 * `onSave` rather than an editor and a uuid: a label is an editor command in
 * the paginated editor and a spine write in the passage stack, and the dialog
 * has no reason to know which.
 */
export const EditLabel = ({
  label,
  onSave,
  close,
}: {
  label: string;
  onSave: (label: string) => void;
  close: () => void;
}) => {
  const [newLabel, setNewLabel] = useState(label || '');
  const updateNewLabel = (event: ChangeEvent<HTMLInputElement>) => {
    setNewLabel(event.target.value);
  };

  const save = useCallback(() => {
    onSave(newLabel);
    close();
  }, [onSave, newLabel, close]);

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogTitle>Edit Passage Label</DialogTitle>
      <DialogDescription>{`Update the label for passage ${label}`}</DialogDescription>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Input
          type="text"
          value={newLabel}
          onChange={updateNewLabel}
          onBlur={updateNewLabel}
          className="mt-2"
          placeholder="X.X"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={close}>
            Cancel
          </Button>
          <Button variant="default" size="sm" type="submit" className="px-5">
            Save
          </Button>
        </div>
      </form>
    </DialogContent>
  );
};
