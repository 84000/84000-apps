'use client';

import {
  DEFAULT_HOVER_CARD_CLOSE_DELAY,
  DEFAULT_HOVER_CARD_OPEN_DELAY,
} from '@design-system';
import { isInBounds } from '@lib-utils';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { TranslationHoverCard } from './TranslationHoverCard';
import { GlossaryInstance } from '../editor/extensions/GlossaryInstance/GlossaryInstance';
import { EndNoteLinkHoverContent } from '../editor/extensions/EndNoteLink/EndNoteLinkHoverContent';
import { LinkHoverContent } from '../editor/extensions/Link/LinkHoverContent';
import { InternalLinkHoverContent } from '../editor/extensions/InternalLink/InternalLinkHoverContent';
import { Editor } from '@tiptap/core';
import { getEditorForElement } from '../editor/util';

export type HoverCardType =
  | 'glossaryInstance'
  | 'endNoteLink'
  | 'link'
  | 'internalLink';

const TYPE_ATTRIBUTE_MAP: Record<HoverCardType, string> = {
  glossaryInstance: 'uuid',
  endNoteLink: 'uuid',
  link: 'uuid',
  internalLink: 'uuid',
};

export interface HoverCardState {
  anchor: HTMLElement | null;
  uuid?: string;
  cardType?: HoverCardType;
  editor?: Editor;
  setAnchor: (anchor: HTMLElement | null) => void;
  setUuid: (uuid?: string) => void;
  setCard: (card: HTMLElement | null) => void;
  close: () => void;
}

export const HoverCardContext = createContext<HoverCardState>({
  anchor: null,
  setAnchor: () => {
    throw new Error('setAnchor function not implemented');
  },
  setCard: () => {
    throw new Error('setCard function not implemented');
  },
  setUuid: () => {
    throw new Error('setUuid function not implemented');
  },
  close: () => {
    throw new Error('close function not implemented');
  },
});

export const HoverCardProvider = ({
  openDelay = DEFAULT_HOVER_CARD_OPEN_DELAY,
  closeDelay = DEFAULT_HOVER_CARD_CLOSE_DELAY,
  typeMap = TYPE_ATTRIBUTE_MAP,
  children,
}: {
  closeDelay?: number;
  openDelay?: number;
  typeMap?: Record<string, string>;
  children: ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  // Get editor for anchor element using the WeakMap registry
  const getEditorForAnchor = useCallback(
    (anchorEl: HTMLElement): Editor | undefined => {
      const editor = getEditorForElement(anchorEl);
      return editor?.isEditable ? editor : undefined;
    },
    [],
  );

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [card, setCard] = useState<HTMLElement | null>(null);
  const [uuid, setUuid] = useState<string>();
  const [cardType, setCardType] = useState<HoverCardType>();
  const [isHoveringAnchor, setIsHoveringAnchor] = useState(false);
  const [isHoveringCard, setIsHoveringCard] = useState(false);

  // Get the editor for the current anchor
  const editor = useMemo(() => {
    if (!anchor) return undefined;
    return getEditorForAnchor(anchor);
  }, [anchor, getEditorForAnchor]);

  const close = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setAnchor(null);
      setUuid(undefined);
      setCardType(undefined);
    }, closeDelay);
  }, [closeDelay]);

  useEffect(() => {
    const editorEl = containerRef.current;
    if (!editorEl) {
      return;
    }
    const types = Object.keys(typeMap)
      .map((type) => `[type="${type}"]`)
      .join(', ');

    const handleMouseOver = (event: MouseEvent) => {
      if (isHoveringAnchor || isHoveringCard) {
        return;
      }

      const target = (event.target as HTMLDivElement).closest<HTMLElement>(
        types,
      );

      if (!target) {
        return;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const typeAttr = target.getAttribute('type');
        if (!typeAttr) {
          return;
        }

        const attribute = typeMap[typeAttr];

        if (!attribute) {
          return;
        }

        const uuidAttr = target.getAttribute(attribute);

        setCardType(typeAttr as HoverCardType);
        if (uuidAttr) {
          setIsHoveringAnchor(true);
          setAnchor(target);
          setUuid(uuidAttr);
        }
      }, openDelay);
    };

    const handleMouseLeave = (event: MouseEvent) => {
      const target = (event.target as HTMLDivElement).closest<HTMLElement>(
        types,
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
    containerRef,
    typeMap,
    openDelay,
    closeDelay,
    isHoveringAnchor,
    isHoveringCard,
    close,
  ]);

  useEffect(() => {
    const handleMouseMove = (evt: MouseEvent) => {
      if (!card) {
        return;
      }

      const inCardBounds = isInBounds(evt, card);
      const inAnchorBounds = anchor ? isInBounds(evt, anchor) : false;
      if (inCardBounds) {
        evt.stopPropagation();
      }

      setIsHoveringAnchor(inAnchorBounds);
      setIsHoveringCard(inCardBounds);
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
    const events = ['mouseenter', 'mouseleave', 'mouseover', 'mouseout'];

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

  const renderCard = (uuid: string, type: string, anchorEl: HTMLElement) => {
    if (!editor) return null;

    if (type === 'glossaryInstance') {
      const glossary = anchorEl.getAttribute('glossary') || '';
      return (
        <GlossaryInstance
          uuid={uuid}
          glossary={glossary}
          editor={editor}
          anchor={anchorEl}
        />
      );
    }
    if (type === 'endNoteLink') {
      const endNote = anchorEl.getAttribute('endNote') || '';
      return (
        <EndNoteLinkHoverContent
          uuid={uuid}
          endNote={endNote}
          editor={editor}
          anchor={anchorEl}
        />
      );
    }
    if (type === 'link') {
      const href = anchorEl.getAttribute('href') || '';
      return (
        <LinkHoverContent
          uuid={uuid}
          href={href}
          editor={editor}
          anchor={anchorEl}
        />
      );
    }
    if (type === 'internalLink') {
      const entityType = anchorEl.getAttribute('entity-type') || '';
      const entity = anchorEl.getAttribute('entity') || '';
      return (
        <InternalLinkHoverContent
          uuid={uuid}
          entityType={entityType}
          entity={entity}
          editor={editor}
          anchor={anchorEl}
        />
      );
    }
    return null;
  };

  const closeImmediately = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setAnchor(null);
    setUuid(undefined);
    setCardType(undefined);
    setIsHoveringAnchor(false);
    setIsHoveringCard(false);
  }, []);

  // Only show hover card when editor is available (editing mode only)
  const shouldShowCard = anchor && uuid && cardType && editor;

  return (
    <HoverCardContext.Provider
      value={{
        anchor,
        uuid,
        cardType,
        editor,
        setAnchor,
        setCard,
        setUuid,
        close: closeImmediately,
      }}
    >
      <div className="size-full" ref={containerRef}>
        {children}
      </div>
      {shouldShowCard && (
        <TranslationHoverCard className="p-0" anchor={anchor} setCard={setCard}>
          {renderCard(uuid, cardType, anchor)}
        </TranslationHoverCard>
      )}
    </HoverCardContext.Provider>
  );
};

export const useHoverCard = () => {
  const context = useContext(HoverCardContext);
  if (!context) {
    throw new Error('useHoverCard must be used within a HoverCardProvider');
  }

  return context;
};
