'use client';

import { highlightText, removeHtmlTags, useIsMobile } from '@eightyfourthousand/lib-utils';
import {
  AlignmentMatch,
  BibliographyMatch,
  GlossaryMatch,
  PassageMatch,
  SearchResult,
} from '../types';
import { Separator } from '@eightyfourthousand/design-system';

const renderPassageHighlight = ({
  activeOccurrenceStart,
  query,
  text,
}: {
  activeOccurrenceStart?: number;
  query: string;
  text: string;
}) => {
  if (!query.trim()) {
    return text;
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
  let offset = 0;

  return parts.map((part, index) => {
    const isMatch = part.toLowerCase() === query.toLowerCase();

    if (!isMatch) {
      offset += part.length;
      return part;
    }

    const start = offset;
    offset += part.length;

    return (
      <mark
        key={index}
        className={
          start === activeOccurrenceStart
            ? 'bg-accent/20 text-foreground font-semibold ring-2 ring-accent ring-offset-1 ring-offset-background rounded-sm'
            : 'bg-highlight text-foreground font-semibold'
        }
      >
        {part}
      </mark>
    );
  });
};

export const PassageResult = ({
  activeOccurrenceStart,
  match,
  query,
}: {
  activeOccurrenceStart?: number;
  match: PassageMatch;
  query: string;
}) => {
  return (
    <div>
      {renderPassageHighlight({
        activeOccurrenceStart,
        query,
        text: match.content,
      })}
    </div>
  );
};

export const AlignmentResult = ({
  match,
  query,
}: {
  match: AlignmentMatch;
  query: string;
}) => {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>{highlightText(match.content, query)}</div>
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
  return <div>{highlightText(removeHtmlTags(match.content), query)}</div>;
};

export const SearchResultCard = ({
  isActive = false,
  activeOccurrenceStart,
  match,
  query,
  onClick,
}: {
  isActive?: boolean;
  activeOccurrenceStart?: number;
  match: SearchResult;
  query: string;
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
          />
        );
      case 'alignment':
        return (
          <AlignmentResult match={match as AlignmentMatch} query={query} />
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
        ? 'border-accent border-4 scroll-mt-4'
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
