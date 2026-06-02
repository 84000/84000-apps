'use client';

import { Button } from '@eightyfourthousand/design-system';
import { cn } from '@eightyfourthousand/lib-utils';
import { Glasses } from 'lucide-react';
import { useNavigation } from './NavigationProvider';

export const FocusToggleButton = () => {
  const { focusMode, setFocusMode } = useNavigation();

  return (
    <Button
      variant="link"
      size="icon"
      aria-pressed={focusMode}
      className={cn(
        'cursor-pointer [&_svg]:size-5 [&_svg]:stroke-1 transition-all',
        focusMode ? 'text-accent' : 'text-accent/60 hover:text-accent',
      )}
      onClick={() => setFocusMode(!focusMode)}
    >
      <Glasses />
      <span className="sr-only">Toggle non-distracted view</span>
    </Button>
  );
};
