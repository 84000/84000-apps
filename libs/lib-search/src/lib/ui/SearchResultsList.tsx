import { SearchResult } from '../types';
import { SearchResultCard } from './SearchResultCard';

export const SearchResultsList = ({
  activePassageUuid,
  query,
  results,
  onCardClick,
}: {
  activePassageUuid?: string;
  query: string;
  results: SearchResult[];
  onCardClick: (result: SearchResult) => void;
}) => {
  return (
    <div className="h-full flex flex-col gap-3 pb-4 overflow-y-auto min-h-0">
      {results.map((result, index) => (
        <SearchResultCard
          key={index}
          isActive={result.uuid === activePassageUuid}
          match={result}
          query={query}
          onClick={() => onCardClick(result)}
        />
      ))}
    </div>
  );
};
