import { Button, Input } from '@design-system';
import { CheckIcon, Trash2Icon } from 'lucide-react';
import { useRef } from 'react';

export const HoverInputField = ({
  placeholder,
  valueRef,
  onSubmit,
}: {
  type: string;
  attr: string;
  valueRef: string;
  placeholder: string;
  onSubmit: (value?: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex space-x-1 items-center">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={valueRef}
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
        <CheckIcon />
      </Button>
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
        <Trash2Icon className="text-destructive" />
      </Button>
    </div>
  );
};
