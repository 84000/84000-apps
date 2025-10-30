'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Input,
  Tabs,
  TabsContent,
} from '@design-system';
import { Loader2Icon, SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { search } from '../data';
import { usePathname, useSearchParams } from 'next/navigation';
import { RESULTS_ENTITIES, SearchResults } from '../types';
import { SearchResultsList } from './SearchResultsList';
import { SearchResultTabs } from './SearchResultTab';

export const SearchButton = () => {
  const [workUuid, setWorkUuid] = useState<string>();
  const [toh, setToh] = useState<string>();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResults>();

  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const uuidFromPath = pathname.split('/').at(-1);
    setWorkUuid(uuidFromPath || '');

    const tohParam = searchParams.get('toh') || '';
    setToh(tohParam);
  }, [pathname, searchParams]);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery || !workUuid || !toh) {
        setResults(undefined);
        return;
      }

      setSearching(true);

      const results = await search({ text: searchQuery, uuid: workUuid, toh });
      setHasResults(
        !!results &&
          (results.passages.length > 0 ||
            results.alignments.length > 0 ||
            results.bibliographies.length > 0 ||
            results.glossaries.length > 0),
      );
      setResults(results);
      setSearching(false);
    };

    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, workUuid, toh]);

  useEffect(() => {
    setResults(undefined);
    setSearchQuery('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className="text-brick hover:text-brick-800 py-3.5"
        >
          <SearchIcon className="size-6" />
          <span className="hidden lg:flex">Search text</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="bg-transparent top-4 max-w-4xl shadow-none border-0 text-secondary translate-y-0"
      >
        <DialogTitle className="hidden">Search</DialogTitle>
        <DialogDescription className="hidden">
          Search this translation
        </DialogDescription>
        <div className="flex flex-col justify-start gap-2 h-[calc(100vh_-_2.5rem)]">
          <div className="w-full flex flex-col gap-2 text-primary flex-shrink-0">
            <div className="flex justify-end">
              <Button
                className="text-secondary -me-3"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
              >
                <XIcon className="size-3 my-auto" />
              </Button>
            </div>
            <Input
              autoFocus
              placeholder="Type to search..."
              className="w-full text-primary px-4 py-6"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {searchQuery && (
            <>
              <div className="text-sm text-secondary">
                Showing results for "<strong>{searchQuery}</strong>"
                {searching && (
                  <Loader2Icon className="size-4 ml-2 animate-spin inline-block" />
                )}
              </div>
              {results && hasResults ? (
                <Tabs
                  defaultValue="passages"
                  className="flex flex-col grow min-h-0 pt-2"
                >
                  <SearchResultTabs results={results} />
                  {RESULTS_ENTITIES.map(
                    (tab) =>
                      results[tab].length > 0 && (
                        <TabsContent
                          key={tab}
                          className="grow min-h-0"
                          value={tab}
                        >
                          <SearchResultsList
                            query={searchQuery}
                            results={results[tab]}
                          />
                        </TabsContent>
                      ),
                  )}
                </Tabs>
              ) : (
                <div className="mt-4 text-secondary">No results found.</div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
