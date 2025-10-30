import { SearchResult } from '../types';
import { SearchResultCard } from './SearchResultCard';

export const SearchResultsList = ({
  query,
  results,
  onCardClick,
}: {
  query: string;
  results: SearchResult[];
  onCardClick: (result: SearchResult) => void;
}) => {
  return (
    <div className="h-full flex flex-col gap-3 pb-4 overflow-y-auto min-h-0">
      {results.map((result, index) => (
        <SearchResultCard
          key={index}
          match={result}
          query={query}
          onClick={() => onCardClick(result)}
        />
      ))}
    </div>
  );
};
