'use client';

import { Button } from '@eightyfourthousand/design-system';
import { cn } from '@eightyfourthousand/lib-utils';
import { Glasses } from 'lucide-react';
import { useNavigation } from './NavigationProvider';

export const FocusToggleButton = () => {
  const { focusMode, setFocusMode } = useNavigation();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-pressed={focusMode}
      className={cn(
        'cursor-pointer [&_svg]:size-5 md:[&_svg]:size-7 size-6 md:size-9 [&_svg]:stroke-1 transition-all',
        focusMode
          ? 'bg-accent text-accent-foreground hover:bg-accent/90'
          : 'text-accent hover:text-accent hover:bg-muted',
      )}
      onClick={() => setFocusMode(!focusMode)}
    >
      <Glasses />
      <span className="sr-only">Toggle non-distracted view</span>
    </Button>
  );
};
