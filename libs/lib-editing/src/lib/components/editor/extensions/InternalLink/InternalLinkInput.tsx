import { Button, Input } from '@design-system';
import { CheckIcon, Trash2Icon } from 'lucide-react';
import { useRef } from 'react';

export const InternalLinkInput = ({
  type,
  uuid,
  onSubmit,
}: {
  type: string;
  uuid: string;
  onSubmit: (type?: string, entity?: string) => void;
}) => {
  const typeRef = useRef<HTMLInputElement>(null);
  const uuidRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    onSubmit(typeRef.current?.value, uuidRef.current?.value);
  };

  return (
    <div className="flex justify-between gap-2 p-0 w-fit max-w-80">
      <Input
        ref={typeRef}
        placeholder="Entity type..."
        value={type}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Input
        ref={uuidRef}
        placeholder="Entity uuid..."
        value={uuid}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Button
        size="icon"
        variant="ghost"
        disabled={!!uuidRef.current && !!typeRef.current}
        onClick={submit}
      >
        <CheckIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={() => {
          if (uuidRef.current) {
            uuidRef.current.value = '';
          }
          if (typeRef.current) {
            typeRef.current.value = '';
          }
          onSubmit();
        }}
      >
        <Trash2Icon className="text-destructive" />
      </Button>
    </div>
  );
};
