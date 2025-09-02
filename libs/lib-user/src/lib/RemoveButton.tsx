'use client';

import { useState } from 'react';
import { LibraryItemType } from '@data-access';
import { Button } from '@design-system';
import { CircleMinusIcon, Loader2Icon } from 'lucide-react';
import { useProfile } from './ProfileProvider';

export const RemoveButton = ({
  uuid,
  type,
  onRemove,
}: {
  uuid: string;
  type: LibraryItemType;
  onRemove?: (success: boolean) => void;
}) => {
  const { refreshCache, removeItem } = useProfile();
  const [isWorking, setIsWorking] = useState(false);

  return (
    <Button
      className={isWorking ? '' : 'text-brick hover:cursor-pointer'}
      variant="ghost"
      size="icon"
      disabled={isWorking}
      onClick={() => {
        if (isWorking) {
          return;
        }

        setIsWorking(true);
        (async () => {
          const success = await removeItem(uuid);
          if (success) {
            await refreshCache(type);
          }
          setIsWorking(false);
          onRemove?.(success);
        })();
      }}
    >
      {isWorking ? (
        <Loader2Icon className="animate-spin" />
      ) : (
        <CircleMinusIcon />
      )}
    </Button>
  );
};
