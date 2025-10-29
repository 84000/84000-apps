import { highlightText, removeHtmlTags } from '@lib-utils';
import {
  AlignmentMatch,
  BibliographyMatch,
  GlossaryMatch,
  PassageMatch,
  SearchResult,
} from '../types';
import { Separator } from '@design-system';

export const PassageResult = ({
  match,
  query,
}: {
  match: PassageMatch;
  query: string;
}) => {
  return <div>{highlightText(match.content, query)}</div>;
};

export const AlignmentResult = ({
  match,
  query,
}: {
  match: AlignmentMatch;
  query: string;
}) => {
  return (
    <div className="grid grid-cols-2 gap-4">
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
  match,
  query,
}: {
  match: SearchResult;
  query: string;
}) => {
  // cast as passage but treat properties as optional
  const passage = match as PassageMatch;

  const renderInner = (match: SearchResult) => {
    switch (match.type) {
      case 'passage':
        return <PassageResult match={match as PassageMatch} query={query} />;
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
    <div className="flex gap-4 p-6 font-serif text-sm text-primary rounded-md bg-background cursor-pointer border border-2 border-transparent hover:border-emerald transition-colors">
      <div className="w-25 flex-shrink-0 flex flex-col gap-2 text-right">
        <span className="text-ochre">{passage.type}</span>
        <div className="grow" />
        {passage.label && <span className="text-brick">{passage.label}</span>}
        {passage.section && (
          <span className="text-primary/50">{passage.section}</span>
        )}
      </div>
      <Separator orientation="vertical" />
      {renderInner(match)}
    </div>
  );
};
