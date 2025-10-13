import { Button, Input } from '@design-system';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { CheckIcon, Trash2Icon } from 'lucide-react';
import { useRef } from 'react';

export const SelectorInputField = ({
  editor,
  type,
  attr,
  placeholder,
  onSubmit,
}: {
  editor: Editor;
  type: string;
  attr: string;
  placeholder: string;
  onSubmit: (value?: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const editorState = useEditorState({
    editor,
    selector: (instance) => ({
      isActive: instance.editor.isActive(type),
      getValue: instance.editor.getAttributes(type)[attr],
    }),
  });

  return (
    <div className="flex space-x-1 items-center">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={editorState.getValue}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit(inputRef.current?.value);
          }
        }}
      />
      <Button
        size="icon"
        variant="ghost"
        disabled={!!inputRef.current}
        onClick={() => onSubmit(inputRef.current?.value)}
      >
        <CheckIcon className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        disabled={!editorState.isActive}
        onClick={() => {
          if (inputRef.current) {
            inputRef.current.value = '';
          }
          onSubmit();
        }}
      >
        <Trash2Icon className="size-4 text-destructive" />
      </Button>
    </div>
  );
};
