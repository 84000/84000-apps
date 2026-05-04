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
import { Separator } from '@eightyfourthousand/design-system';

const markClassName = (isActive: boolean) =>
  isActive
    ? 'bg-accent/20 text-foreground font-semibold ring-2 ring-accent ring-offset-1 ring-offset-background rounded-sm'
    : 'bg-highlight text-foreground font-semibold';

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
  if (!query.trim()) {
    return text;
  }

  if (useRegex) {
    let regex: RegExp;
    try {
      regex = new RegExp(query, 'gi');
    } catch {
      return text;
    }

    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      if (match.index > lastIndex) {
        nodes.push(text.slice(lastIndex, match.index));
      }
      nodes.push(
        <mark key={match.index} className={markClassName(match.index === activeOccurrenceStart)}>
          {match[0]}
        </mark>,
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }

    return nodes;
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
      <mark key={index} className={markClassName(start === activeOccurrenceStart)}>
        {part}
      </mark>
    );
  });
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

export const AlignmentResult = ({
  activeOccurrenceStart,
  match,
  query,
  useRegex,
}: {
  activeOccurrenceStart?: number;
  match: AlignmentMatch;
  query: string;
  useRegex?: boolean;
}) => {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        {renderPassageHighlight({
          activeOccurrenceStart,
          query,
          text: match.content,
          useRegex,
        })}
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
  useRegex,
  onClick,
}: {
  isActive?: boolean;
  activeOccurrenceStart?: number;
  match: SearchResult;
  query: string;
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
