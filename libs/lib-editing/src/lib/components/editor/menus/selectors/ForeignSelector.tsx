'use client';

import { useState } from 'react';
import { ExtendedTranslationLanguage } from '@eightyfourthousand/data-access';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@eightyfourthousand/design-system';
import { CheckIcon, ChevronDownIcon, LanguagesIcon, XIcon } from 'lucide-react';
import { cn } from '@eightyfourthousand/lib-utils';

interface SelectorResult {
  isEnglish: boolean;
  isSanskrit: boolean;
  isTibetan: boolean;
  isWylie: boolean;
  isMixed: boolean;
}

interface MenuItem {
  name: string;
  lang?: ExtendedTranslationLanguage;
  isActive: (state: SelectorResult) => boolean;
}

const items: MenuItem[] = [
  { name: 'English', lang: 'en', isActive: (s) => s.isEnglish },
  { name: 'Sanskrit', lang: 'Sa-Ltn', isActive: (s) => s.isSanskrit },
  { name: 'Wylie', lang: 'Bo-Ltn', isActive: (s) => s.isWylie },
  { name: 'Tibetan', lang: 'bo', isActive: (s) => s.isTibetan },
  { name: 'Mixed', lang: undefined, isActive: (s) => s.isMixed },
];

export const ForeignSelector = ({ editor }: { editor: Editor }) => {
  const [open, setOpen] = useState(false);

  const editorState = useEditorState({
    editor,
    selector: (instance) => ({
      isEnglish: instance.editor.isActive('foreign', { lang: 'en' }),
      isSanskrit: instance.editor.isActive('foreign', { lang: 'Sa-Ltn' }),
      isTibetan: instance.editor.isActive('foreign', { lang: 'bo' }),
      isWylie: instance.editor.isActive('foreign', { lang: 'Bo-Ltn' }),
      isMixed: instance.editor.isActive('foreign', { lang: undefined }),
    }),
  });

  const isActive =
    editorState.isEnglish ||
    editorState.isSanskrit ||
    editorState.isTibetan ||
    editorState.isWylie ||
    editorState.isMixed;

  const handleSelect = (lang?: ExtendedTranslationLanguage) => {
    const to = editor.state.selection.to;
    editor
      .chain()
      .toggleForeign(lang)
      .setTextSelection(to)
      .blur()
      .run();
    setOpen(false);
  };

  const handleRemove = () => {
    const to = editor.state.selection.to;
    editor
      .chain()
      .unsetForeign()
      .setTextSelection(to)
      .blur()
      .run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="rounded-none">
          <LanguagesIcon
            className={cn(
              'size-3',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
            strokeWidth={2.5}
          />
          <ChevronDownIcon className="size-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-28 shadow-xl rounded-md border p-1"
        align="end"
        noPortal
      >
        {items.map((item) => (
          <div
            key={item.name}
            className="flex items-center text-sm rounded-md hover:bg-muted text-foreground px-2 py-1.5 cursor-pointer"
            onClick={() => handleSelect(item.lang)}
          >
            <span>{item.name}</span>
            <div className="flex-1"></div>
            {item.isActive(editorState) && (
              <CheckIcon className="size-3.5 ms-4" />
            )}
          </div>
        ))}
        {isActive && (
          <>
            <div className="h-px bg-border my-1" />
            <div
              className="flex items-center text-sm rounded-md hover:bg-muted text-foreground px-2 py-1.5 cursor-pointer"
              onClick={handleRemove}
            >
              <span>Remove</span>
              <div className="flex-1"></div>
              <XIcon className="size-3.5 ms-4" />
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
