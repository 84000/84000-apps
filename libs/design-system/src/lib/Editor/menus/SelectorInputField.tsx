import { Button } from '../../Button/Button';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { CheckIcon, Trash2Icon } from 'lucide-react';
import { useRef } from 'react';
import { Input } from '../../Input/Input';

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
    <form
      className="flex space-x-1 items-center"
      onSubmit={(evt) => {
        evt.preventDefault();
        onSubmit(inputRef.current?.value);
      }}
    >
      <Input
        ref={inputRef}
        placeholder={placeholder}
        defaultValue={editorState.getValue}
      />
      {editorState.isActive ? (
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.value = '';
            }
            onSubmit();
          }}
        >
          <Trash2Icon className="size-4 text-destructive" />
        </Button>
      ) : (
        <Button size="icon" variant="ghost">
          <CheckIcon className="size-4" />
        </Button>
      )}
    </form>
  );
};
