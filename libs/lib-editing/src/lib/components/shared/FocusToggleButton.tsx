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
        'cursor-pointer rounded-full [&_svg]:size-5 [&_svg]:stroke-1 transition-all',
        focusMode
          ? 'bg-accent text-accent-foreground hover:bg-accent/90'
          : 'text-accent/60 hover:text-accent hover:bg-muted',
      )}
      onClick={() => setFocusMode(!focusMode)}
    >
      <Glasses />
      <span className="sr-only">Toggle non-distracted view</span>
    </Button>
  );
};
