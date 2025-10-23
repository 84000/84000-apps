import {
  DEFAULT_HOVER_CARD_CLOSE_DELAY,
  DEFAULT_HOVER_CARD_OPEN_DELAY,
} from '@design-system';
import { RefObject, useEffect, useRef, useState } from 'react';

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

  const [anchor, setAnchor] = useState<HTMLElement>();
  const [uuid, setUuid] = useState<string>();

  useEffect(() => {
    const editorEl = editorRef.current;
    if (!editorEl) {
      return;
    }

    const handleMouseOver = (event: MouseEvent) => {
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
        if (uuidAttr) {
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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setAnchor(undefined);
        setUuid(undefined);
      }, closeDelay);
    };

    editorEl.addEventListener('mouseenter', handleMouseOver, true);
    editorEl.addEventListener('mouseleave', handleMouseLeave, true);

    return () => {
      editorEl.removeEventListener('mouseenter', handleMouseOver, true);
      editorEl.removeEventListener('mouseleave', handleMouseLeave, true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [editorRef, type, openDelay, closeDelay, attribute]);

  return {
    anchor,
    uuid,
    setAnchor,
    setUuid,
  };
};
