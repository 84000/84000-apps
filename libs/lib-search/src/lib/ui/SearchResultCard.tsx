'use client';

import React from 'react';
import { highlightText, removeDiacritics, removeHtmlTags, useIsMobile } from '@eightyfourthousand/lib-utils';
import {
  AlignmentMatch,
  BibliographyMatch,
  GlossaryMatch,
  PassageMatch,
  SearchResult,
} from '../types';
import { findHighlightRanges, markClassName } from './highlight';
import { Separator } from '@eightyfourthousand/design-system';

const renderPassageHighlight = ({
  activeOccurrenceStart,
  query,
  text,
  useRegex,
}: {
  activeOccurrenceStart?: number;
  query: string;
  text: string;
  useRegex?: boolean;
}) => {
  const ranges = findHighlightRanges(text, query, useRegex);
  if (ranges.length === 0) {
    return text;
  }

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  ranges.forEach(({ start, end }) => {
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    nodes.push(
      <mark key={start} className={markClassName(start === activeOccurrenceStart)}>
        {text.slice(start, end)}
      </mark>,
    );
    lastIndex = end;
  });
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

export const PassageResult = ({
  activeOccurrenceStart,
  match,
  query,
  useRegex,
}: {
  activeOccurrenceStart?: number;
  match: PassageMatch;
  query: string;
  useRegex?: boolean;
}) => {
  return (
    <div>
      {renderPassageHighlight({
        activeOccurrenceStart,
        query,
        text: match.content,
        useRegex,
      })}
    </div>
  );
};

/** What an injected renderer is given to draw an alignment's English side. */
export interface AlignmentEnglishProps {
  activeOccurrenceStart?: number;
  match: AlignmentMatch;
  query: string;
  useRegex?: boolean;
  /** The plain-text rendering, to show while loading or on failure. */
  fallback: React.ReactNode;
}

/** Draws an alignment's English side in place of its plain text. */
export type RenderAlignmentEnglish = (
  props: AlignmentEnglishProps,
) => React.ReactNode;

/** Margin around the viewport within which a result counts as in view. */
const IN_VIEW_MARGIN = '200px 0px';

/** True once the element has come within the margin of the viewport. */
const useSeen = (enabled: boolean) => {
  const ref = React.useRef<HTMLDivElement>(null);
  // Without an observer, everything counts as in view.
  const [seen, setSeen] = React.useState(
    () => typeof IntersectionObserver === 'undefined',
  );

  React.useEffect(() => {
    const element = ref.current;
    if (!enabled || seen || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: IN_VIEW_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, seen]);

  return { ref, seen };
};

export const AlignmentResult = ({
  activeOccurrenceStart,
  match,
  query,
  renderEnglish,
  useRegex,
}: {
  activeOccurrenceStart?: number;
  match: AlignmentMatch;
  query: string;
  renderEnglish?: RenderAlignmentEnglish;
  useRegex?: boolean;
}) => {
  // The renderer may load the passage, so it is only called once in view.
  const { ref, seen } = useSeen(!!renderEnglish);
  const fallback = renderPassageHighlight({
    activeOccurrenceStart,
    query,
    text: match.content,
    useRegex,
  });

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div ref={ref}>
        {renderEnglish && seen
          ? renderEnglish({
              activeOccurrenceStart,
              match,
              query,
              useRegex,
              fallback,
            })
          : fallback}
      </div>
      <div className="text-lg">{highlightText(match.source, query)}</div>
    </div>
  );
};

export const BibliographyResult = ({
  match,
  query,
}: {
  match: BibliographyMatch;
  query: string;
}) => {
  return <div>{highlightText(removeHtmlTags(match.content), query)}</div>;
};

export const GlossaryResult = ({
  match,
  query,
}: {
  match: GlossaryMatch;
  query: string;
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className='text-primary font-bold'>{
        highlightText(
          removeDiacritics(match.content),
          removeDiacritics(query)
        )
      }</div>
      {match.entry.definition && <div
        className="glossary-instance-definition"
        dangerouslySetInnerHTML={{ __html: match.entry.definition }}
      />}
    </div>
  );
};

export const SearchResultCard = ({
  isActive = false,
  activeOccurrenceStart,
  match,
  query,
  renderAlignmentEnglish,
  useRegex,
  onClick,
}: {
  isActive?: boolean;
  activeOccurrenceStart?: number;
  match: SearchResult;
  query: string;
  renderAlignmentEnglish?: RenderAlignmentEnglish;
  useRegex?: boolean;
  onClick: () => void;
}) => {
  const isMobile = useIsMobile();

  // cast as passage but treat properties as optional
  const passage = match as PassageMatch;

  const renderInner = (match: SearchResult) => {
    switch (match.type) {
      case 'passage':
        return (
          <PassageResult
            activeOccurrenceStart={isActive ? activeOccurrenceStart : undefined}
            match={match as PassageMatch}
            query={query}
            useRegex={useRegex}
          />
        );
      case 'alignment':
        return (
          <AlignmentResult
            activeOccurrenceStart={isActive ? activeOccurrenceStart : undefined}
            match={match as AlignmentMatch}
            query={query}
            renderEnglish={renderAlignmentEnglish}
            useRegex={useRegex}
          />
        );
      case 'bibliography':
        return (
          <BibliographyResult
            match={match as BibliographyMatch}
            query={query}
          />
        );
      case 'glossary':
        return <GlossaryResult match={match as GlossaryMatch} query={query} />;
      default:
        return null;
    }
  };

  return (
    <div
      onClick={onClick}
      data-search-result-active={isActive ? 'true' : undefined}
      className={`flex flex-col md:flex-row gap-4 py-6 px-4 md:px-6 font-serif text-sm text-foreground rounded-lg bg-background cursor-pointer border transition-colors ${isActive
        ? 'border-accent border-2 scroll-mt-4'
        : 'border-transparent hover:border-secondary border-2'
        }`}
    >
      <div className="md:w-28 shrink-0 flex md:flex-col gap-1 md:gap-2 md:text-right text-xs md:text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-secondary capitalize">{passage.type}</span>
          {passage.section && (
            <span className="text-foreground/50 capitalize">
              {passage.section.replace('Header', '')}
            </span>
          )}
        </div>
        <div className="grow" />
        {passage.label && (
          <span className="text-accent mt-auto">{passage.label}</span>
        )}
      </div>
      <Separator orientation={isMobile ? 'horizontal' : 'vertical'} />
      {renderInner(match)}
    </div>
  );
};
