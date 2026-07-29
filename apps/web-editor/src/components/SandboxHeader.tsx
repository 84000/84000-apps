'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  H4,
} from '@eightyfourthousand/design-system';
import { SLUG_PATHS } from './constants';
import { useCallback } from 'react';
import { useSandbox } from './SandboxProvider';
import { Format, Slug } from '@eightyfourthousand/lib-editing/fixtures/types';
import { useRouter } from 'next/navigation';
import { ChevronDownIcon, SplitIcon } from 'lucide-react';

export const SandboxHeader = () => {
  const dropdownItems = Object.keys(SLUG_PATHS)
    .map((slug) =>
      Object.keys(SLUG_PATHS[slug]).map((format) => `${slug} - ${format}`),
    )
    .flat();

  const { slug, format, setFormat, setSlug, editor, setContent } = useSandbox();
  const router = useRouter();

  const selectedItem = slug && format ? `${slug} - ${format}` : undefined;

  const onHandleSelect = useCallback(
    (item: string, checked: boolean) => {
      if (!checked || !item) {
        // Clearing the selection deliberately does not navigate.
        setSlug(undefined);
        setFormat(undefined);
        return;
      }

      const [newSlug, newFormat] = item.split(' - ');
      setSlug(newSlug as Slug);
      setFormat(newFormat as Format);
      router.push(`/${newSlug}/${newFormat}`);
    },
    [setFormat, setSlug, router],
  );

  return (
    <div className="fixed w-full z-50 bg-background border-b border-border">
      <div className="px-6 py-2 flex flex-row justify-between gap-4">
        <H4
          className="hover:cursor-pointer"
          onClick={() => onHandleSelect('', false)}
        >
          Editor Sandbox
        </H4>
        <div className="grow" />
        <Button
          variant="outline"
          size="sm"
          className="my-auto flex gap-2"
          onClick={() => {
            if (editor) setContent(editor.getJSON());
            router.push('/json-compare');
          }}
        >
          <SplitIcon className="size-4" />
          <span>JSON Compare</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="my-auto capitalize flex gap-2">
              <span>{selectedItem ? selectedItem : 'Select Example'}</span>
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {dropdownItems.map((item) => (
              <DropdownMenuCheckboxItem
                key={item}
                className="capitalize"
                checked={item === selectedItem}
                onCheckedChange={(checked) => onHandleSelect(item, checked)}
              >
                {item}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
