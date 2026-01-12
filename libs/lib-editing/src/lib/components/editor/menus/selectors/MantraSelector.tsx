'use client';

import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@design-system';
import { CheckIcon, ChevronDownIcon, SpeechIcon } from 'lucide-react';
import { cn } from '@lib-utils';

interface SelectorResult {
  isEnglish: boolean;
  isSanskrit: boolean;
  isTibetan: boolean;
  isWylie: boolean;
  isMixed: boolean;
}

interface MenuItem {
  name: string;
  onClick: (editor: Editor) => void;
  isActive: (state: SelectorResult) => boolean;
}

const items: MenuItem[] = [
  {
    name: 'English',
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleMantra('en').run();
    },
    isActive: (state: SelectorResult) => state.isEnglish,
  },
  {
    name: 'Sanskrit',
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleMantra('Sa-Ltn').run();
    },
    isActive: (state: SelectorResult) => state.isSanskrit,
  },
  {
    name: 'Wylie',
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleMantra('Bo-Ltn').run();
    },
    isActive: (state: SelectorResult) => state.isWylie,
  },
  {
    name: 'Tibetan',
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleMantra('bo').run();
    },
    isActive: (state: SelectorResult) => state.isTibetan,
  },
  {
    name: 'Mixed',
    onClick: (editor: Editor) => {
      editor.chain().focus().toggleMantra().run();
    },
    isActive: (state: SelectorResult) => state.isMixed,
  },
];

export const MantraSelector = ({ editor }: { editor: Editor }) => {
  const editorState = useEditorState({
    editor,
    selector: (instance) => ({
      isEnglish: instance.editor.isActive('mantra', { lang: 'en' }),
      isSanskrit: instance.editor.isActive('mantra', { lang: 'Sa-Ltn' }),
      isTibetan: instance.editor.isActive('mantra', { lang: 'bo' }),
      isWylie: instance.editor.isActive('mantra', { lang: 'Bo-Ltn' }),
      isMixed: instance.editor.isActive('mantra', { lang: undefined }),
    }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="rounded-none">
          <SpeechIcon
            className={cn(
              'size-3',
              editorState.isEnglish ||
                editorState.isSanskrit ||
                editorState.isTibetan ||
                editorState.isWylie ||
                editorState.isMixed
                ? 'text-primary'
                : 'text-muted-foreground',
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
            onClick={() => item.onClick(editor)}
          >
            <span>{item.name}</span>
            <div className="flex-1"></div>
            {item.isActive(editorState) && (
              <CheckIcon className="size-3.5 ms-4" />
            )}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
};
