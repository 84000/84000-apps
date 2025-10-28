'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Input,
} from '@design-system';
import { SearchIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

export const SearchButton = () => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);

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
        className="bg-transparent top-16 max-w-4xl shadow-none border-0 text-secondary translate-y-0"
      >
        <DialogTitle className="hidden">Search</DialogTitle>
        <DialogDescription className="hidden">
          Search this translation
        </DialogDescription>
        <div className="flex flex-col justify-start gap-2 h-9/10">
          <div className="w-full flex justify-center gap-2 text-primary">
            <Input
              placeholder="Type to search..."
              className="grow"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button
              className="text-secondary"
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
            >
              <XIcon className="size-6" />
            </Button>
          </div>
          {searchQuery && (
            <>
              <div className="text-sm text-secondary">
                Showing results for "<strong>{searchQuery}</strong>"
              </div>
              {results.length > 0 ? (
                <div className="mt-4 bg-background p-4 rounded-md shadow-md  overflow-y-auto">
                  <ul className="list-disc list-inside">
                    {results.map((result, index) => (
                      <li key={index}>{result}</li>
                    ))}
                  </ul>
                </div>
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
