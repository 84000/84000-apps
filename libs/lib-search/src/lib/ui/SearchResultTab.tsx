import { TabsList, TabsTrigger } from '@eightyfourthousand/design-system';
import { RESULTS_ENTITIES, RESULTS_ENTITY_LABELS, SearchResults } from '../types';

export const SearchResultTabs = ({ results }: { results: SearchResults }) => {
  return (
    <TabsList className="h-24 gap-4 flex-shrink-0 rounded-lg p-0 w-full bg-transparent sm:p-0">
      {RESULTS_ENTITIES.map(
        (tab) =>
          results[tab].length > 0 && (
            <TabsTrigger
              key={tab}
              value={tab}
              className="h-full border border-border rounded-xl flex-grow data-[state=inactive]:bg-muted data-[state=active]:border-secondary data-[state=active]:border-3 border-2"
            >
              <div className="flex flex-col gap-1 items-center">
                <span className="text-secondary font-bold">
                  {RESULTS_ENTITY_LABELS[tab]}
                </span>
                <span className="text-primary font-bold">
                  {results[tab].length} matches
                </span>
              </div>
            </TabsTrigger>
          ),
      )}
    </TabsList>
  );
};
