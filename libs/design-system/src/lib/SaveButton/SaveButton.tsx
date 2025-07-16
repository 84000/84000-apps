'use client';

import { Loader2Icon } from 'lucide-react';
import { Button } from '../Button/Button';
import { useState } from 'react';
import { cn } from '@lib-utils';

export const SaveButton = ({
  onClick,
  className,
  disabled = false,
  label = 'Save',
}: {
  onClick: () => Promise<void>;
  disabled?: boolean;
  className?: string;
  label?: string;
}) => {
  const [isSaving, setIsSaving] = useState(false);
  return (
    <Button
      variant="outline"
      size="default"
      className={cn('rounded-full w-18', className)}
      disabled={disabled || isSaving}
      onClick={async () => {
        setIsSaving(true);
        try {
          await onClick();
        } catch (error) {
          console.error('Failed to save:', error);
        } finally {
          setIsSaving(false);
        }
      }}
    >
      {isSaving ? <Loader2Icon className="animate-spin" /> : label}
    </Button>
  );
};
