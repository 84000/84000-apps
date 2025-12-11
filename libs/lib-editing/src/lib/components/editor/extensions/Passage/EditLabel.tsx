'use client';

import {
  Button,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@design-system';
import { NodeViewProps } from '@tiptap/react';
import { ChangeEvent, useCallback, useState } from 'react';

export const EditLabel = ({
  node,
  updateAttributes,
  close,
}: NodeViewProps & { close: () => void }) => {
  const [newLabel, setNewLabel] = useState(node.attrs.label || '');
  const updateNewLabel = (event: ChangeEvent<HTMLInputElement>) => {
    setNewLabel(event.target.value);
  };

  const save = useCallback(() => {
    updateAttributes({ label: newLabel });
    close();
  }, [newLabel, updateAttributes, close]);

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogTitle>Edit Passage Label</DialogTitle>
      <DialogDescription>{`Update the label for passage ${node.attrs.label}`}</DialogDescription>
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
