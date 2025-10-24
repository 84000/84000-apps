import {
  DEFAULT_HOVER_CARD_CLOSE_DELAY,
  DEFAULT_HOVER_CARD_OPEN_DELAY,
} from '@design-system';
import { isInBounds } from '@lib-utils';
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

export const useHover = ({
  type,
  attribute,
  editorRef,
  openDelay = DEFAULT_HOVER_CARD_OPEN_DELAY,
  closeDelay = DEFAULT_HOVER_CARD_CLOSE_DELAY,
}: {
  type: string;
  attribute: string;
  editorRef: RefObject<HTMLDivElement | null>;
  openDelay?: number;
  closeDelay?: number;
}) => {
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [card, setCard] = useState<HTMLElement | null>(null);
  const [uuid, setUuid] = useState<string>();
  const [cardType, setCardType] = useState<string>();
  const [isHoveringAnchor, setIsHoveringAnchor] = useState(false);
  const [isHoveringCard, setIsHoveringCard] = useState(false);

  const close = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setAnchor(null);
      setUuid(undefined);
      setCardType(undefined);
    }, closeDelay);
  }, [closeDelay]);

  useEffect(() => {
    const editorEl = editorRef.current;
    if (!editorEl) {
      return;
    }

    const handleMouseOver = (event: MouseEvent) => {
      if (isHoveringAnchor || isHoveringCard) {
        return;
      }

      const target = (event.target as HTMLDivElement).closest<HTMLElement>(
        `[type="${type}"]`,
      );

      if (!target) {
        return;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const uuidAttr = target.getAttribute(attribute);
        const typeAttr = target.getAttribute('type');

        setCardType(typeAttr || undefined);
        if (uuidAttr) {
          setIsHoveringAnchor(true);
          setAnchor(target);
          setUuid(uuidAttr);
        }
      }, openDelay);
    };

    const handleMouseLeave = (event: MouseEvent) => {
      const target = (event.target as HTMLDivElement).closest<HTMLElement>(
        `[type="${type}"]`,
      );

      if (!target) {
        return;
      }

      setIsHoveringAnchor(false);
    };

    const handlEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsHoveringAnchor(false);
        setIsHoveringCard(false);
        close();
      }
    };

    editorEl.addEventListener('mouseenter', handleMouseOver, true);
    editorEl.addEventListener('mouseleave', handleMouseLeave, true);
    document.addEventListener('keydown', handlEscape, true);

    return () => {
      editorEl.removeEventListener('mouseenter', handleMouseOver, true);
      editorEl.removeEventListener('mouseleave', handleMouseLeave, true);
      document.removeEventListener('keydown', handlEscape, true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    editorRef,
    type,
    openDelay,
    closeDelay,
    attribute,
    isHoveringAnchor,
    isHoveringCard,
    close,
  ]);

  useEffect(() => {
    const handleMouseMove = (evt: MouseEvent) => {
      if (!card) {
        return;
      }

      const inBounds = isInBounds(evt, card);
      if (inBounds) {
        evt.stopPropagation();
      }
      setIsHoveringCard((prev) => {
        if (prev !== inBounds) {
          return inBounds;
        }
        return prev;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [card, anchor, closeDelay]);

  useEffect(() => {
    if (!card) {
      return;
    }

    const stopPropagation = (e: Event) => {
      e.stopPropagation();
    };

    // Stop all mouse events from propagating
    const events = [
      'mouseenter',
      'mouseleave',
      'mouseover',
      'mouseout',
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'contextmenu',
    ];

    events.forEach((eventType) => {
      card.addEventListener(eventType, stopPropagation, true);
    });

    return () => {
      events.forEach((eventType) => {
        card.removeEventListener(eventType, stopPropagation, true);
      });
    };
  }, [card]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isHoveringAnchor || isHoveringCard) {
      return;
    }

    close();
  }, [isHoveringAnchor, isHoveringCard, closeDelay, close]);

  return {
    anchor,
    uuid,
    cardType,
    setAnchor,
    setCard,
    setUuid,
  };
};
