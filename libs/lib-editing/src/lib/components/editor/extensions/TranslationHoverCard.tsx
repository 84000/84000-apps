import {
  autoPlacement,
  autoUpdate,
  offset,
  useFloating,
} from '@floating-ui/react';
import { ReactNode, useEffect, useState } from 'react';
import { cn } from '@lib-utils';

const CARD_OFFSET = 10;
const PLACEMENT_TO_ORIGIN: Record<string, string> = {
  top: 'origin-bottom',
  bottom: 'origin-top',
  left: 'origin-right',
  right: 'origin-left',
};

export const TranslationHoverCard = ({
  anchor,
  className = '',
  children,
}: {
  anchor: HTMLElement;
  className?: string;
  children: ReactNode;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [origin, setOrigin] = useState<string>('origin-top');

  const { refs, floatingStyles, placement } = useFloating({
    middleware: [offset(CARD_OFFSET), autoPlacement()],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    refs.setReference(anchor);
  }, [anchor, refs]);

  useEffect(() => {
    const [primaryPlacement] = placement.split('-');
    const origin = PLACEMENT_TO_ORIGIN[primaryPlacement];

    setOrigin(origin || 'origin-top');
  }, [placement]);

  useEffect(() => {
    if (!refs.floating.current) {
      return;
    }

    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      setIsVisible(false);
    };
  }, [refs]);

  return (
    <div
      ref={refs.setFloating}
      style={{ ...floatingStyles, pointerEvents: 'none' }}
      className={cn(
        'bg-popover text-popover-foreground rounded-md border p-4 shadow-md outline-hidden z-1000',
        'transition-[opacity,scale] duration-150',
        origin,
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        className,
      )}
    >
      {children}
    </div>
  );
};
