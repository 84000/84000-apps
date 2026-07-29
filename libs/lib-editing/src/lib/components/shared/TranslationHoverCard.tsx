import {
  autoUpdate,
  flip,
  inline,
  offset,
  shift,
  useFloating,
} from '@floating-ui/react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@eightyfourthousand/lib-utils';
import { DEFAULT_HOVER_CARD_SIDE_OFFSET } from '@eightyfourthousand/design-system';

export const TranslationHoverCard = ({
  anchor,
  className = '',
  children,
  setCard,
}: {
  anchor: HTMLElement;
  className?: string;
  children: ReactNode;
  setCard: (card: HTMLElement | null) => void;
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start',
    middleware: [
      inline(),
      offset(DEFAULT_HOVER_CARD_SIDE_OFFSET),
      flip(),
      shift(),
    ],
    whileElementsMounted: autoUpdate,
  });

  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refs.setReference(anchor);
  }, [anchor, refs]);

  useEffect(() => {
    setCard(innerRef.current);

    return () => {
      setCard(null);
    };
  }, [innerRef, setCard]);

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
      // `refs.setFloating` is floating-ui's ref *setter*, which is how the
      // floating element is attached. Nothing reads `.current` here, but the
      // rule treats any property of a refs object as a ref access.
      // eslint-disable-next-line react-hooks/refs -- floating-ui ref setter, not a ref read
      ref={refs.setFloating}
      style={{ ...floatingStyles, pointerEvents: 'auto', cursor: 'default' }}
      className="z-100"
    >
      <div
        ref={innerRef}
        className={cn(
          'bg-popover text-popover-foreground rounded-md border p-4 shadow-md outline-hidden hover:cursor-default',
          'transition-[opacity,scale] duration-150 origin-center ease-out',
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-99',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
};
