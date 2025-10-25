'use client';

import {
  DEFAULT_HOVER_CARD_CLOSE_DELAY,
  DEFAULT_HOVER_CARD_OPEN_DELAY,
} from '@design-system';
import { cn, isInBounds } from '@lib-utils';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { TranslationHoverCard } from './TranslationHoverCard';
import { GlossaryInstance } from '../editor/extensions/GlossaryInstance/GlossaryInstance';
import EndNoteLink from '../editor/extensions/EndNoteLink/EndNoteLink';
import { TranslationEditorContent } from '../editor';
import { GlossaryTermInstance } from '@data-access';

const HOVER_CARD_TYPES = ['glossaryInstance', 'endNoteLink'] as const;

export type HoverCardType = (typeof HOVER_CARD_TYPES)[number];

const TYPE_ATTRIBUTE_MAP: Record<HoverCardType, string> = {
  glossaryInstance: 'glossary',
  endNoteLink: 'endNote',
};

export interface HoverCardState {
  anchor: HTMLElement | null;
  uuid?: string;
  cardType?: HoverCardType;
  setAnchor: (anchor: HTMLElement | null) => void;
  setUuid: (uuid?: string) => void;
  setCard: (card: HTMLElement | null) => void;
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
});

export const HoverCardProvider = ({
  openDelay = DEFAULT_HOVER_CARD_OPEN_DELAY,
  closeDelay = DEFAULT_HOVER_CARD_CLOSE_DELAY,
  typeMap = TYPE_ATTRIBUTE_MAP,
  fetchEndNote,
  fetchGlossaryInstance,
  children,
}: {
  closeDelay?: number;
  openDelay?: number;
  typeMap?: Record<string, string>;
  fetchEndNote?: (
    uuid: string,
  ) => Promise<TranslationEditorContent | undefined>;
  fetchGlossaryInstance?: (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;
  children: ReactNode;
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [card, setCard] = useState<HTMLElement | null>(null);
  const [uuid, setUuid] = useState<string>();
  const [cardType, setCardType] = useState<HoverCardType>();
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
    editorRef,
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

  const renderCard = (uuid: string, type: string) => {
    if (type === 'glossaryInstance' && fetchGlossaryInstance) {
      return <GlossaryInstance uuid={uuid} fetch={fetchGlossaryInstance} />;
    }
    if (type === 'endNoteLink' && fetchEndNote) {
      return <EndNoteLink uuid={uuid} fetch={fetchEndNote} />;
    }
    return null;
  };

  return (
    <HoverCardContext.Provider
      value={{
        anchor,
        uuid,
        cardType,
        setAnchor,
        setCard,
        setUuid,
      }}
    >
      <div className="size-full" ref={editorRef}>
        {children}
      </div>
      {anchor && uuid && cardType && fetchGlossaryInstance && fetchEndNote && (
        <TranslationHoverCard
          className={cn(
            cardType === 'endNoteLink' && 'w-120 max-h-96 m-2 overflow-auto',
            cardType === 'glossaryInstance' &&
              'w-120 lg:w-4xl max-h-100 m-2 overflow-auto',
          )}
          anchor={anchor}
          setCard={setCard}
        >
          {renderCard(uuid, cardType)}
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
