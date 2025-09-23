'use client';

import { Loader2Icon } from 'lucide-react';
import { Button, ButtonProps } from '../Button/Button';
import { useState } from 'react';

export const SaveButton = ({
  onClick,
  className,
  disabled = false,
  label = 'Save',
  ...props
}: ButtonProps & {
  onClick: () => Promise<void>;
  disabled?: boolean;
  className?: string;
  label?: string;
}) => {
  const [isSaving, setIsSaving] = useState(false);
  return (
    <Button
      className={className}
      disabled={disabled || isSaving}
      onClick={async () => {
        setIsSaving(true);
        try {
          await onClick();
        } catch (error) {
          // TODO: handle error properly, e.g., show a toast notification
          console.error('Failed to save:', error);
        } finally {
          setIsSaving(false);
        }
      }}
      {...props}
    >
      {isSaving ? <Loader2Icon className="animate-spin" /> : label}
    </Button>
  );
};
