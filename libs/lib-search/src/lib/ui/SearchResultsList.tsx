import { SearchResult } from '../types';
import { SearchResultCard } from './SearchResultCard';

export const SearchResultsList = ({
  activeOccurrenceStart,
  activePassageUuid,
  query,
  results,
  onCardClick,
}: {
  activeOccurrenceStart?: number;
  activePassageUuid?: string;
  query: string;
  results: SearchResult[];
  onCardClick: (result: SearchResult) => void;
}) => {
  return (
    <div className="h-full flex flex-col gap-3 pb-4 overflow-y-auto min-h-0">
      {results.map((result, index) => {
        const start = result.uuid === activePassageUuid ? activeOccurrenceStart : undefined;
        const isActive = !!start;
        return (
          <SearchResultCard
            key={index}
            activeOccurrenceStart={start}
            isActive={isActive}
            match={result}
            query={query}
            onClick={() => onCardClick(result)}
          />
        )
      })}
    </div>
  );
};
