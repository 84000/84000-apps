'use client';

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@eightyfourthousand/design-system';
import { WordBreakValue } from '@eightyfourthousand/data-access';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  CheckIcon,
  ChevronDownIcon,
  ListMinusIcon,
  LucideIcon,
  WrapTextIcon,
} from 'lucide-react';

interface SelectorResult {
  isParagraph: boolean;
  isNormal: boolean;
  isBreakAll: boolean;
}

// When a paragraph has no explicit word-break, the rendered default is the CSS
// default `normal`.
const DEFAULT_WORD_BREAK: WordBreakValue = 'normal';

const items: {
  title: string;
  wordBreak: WordBreakValue;
  icon: LucideIcon;
}[] = [
  { title: 'Normal', wordBreak: 'normal', icon: ListMinusIcon },
  { title: 'Break all', wordBreak: 'break-all', icon: WrapTextIcon },
];

export const WordBreakSelector = ({ editor }: { editor: Editor }) => {
  const editorState = useEditorState<SelectorResult>({
    editor,
    selector: (instance) => ({
      isParagraph: instance.editor.isActive('paragraph'),
      isNormal: instance.editor.isActive({ wordBreak: 'normal' }),
      isBreakAll: instance.editor.isActive({ wordBreak: 'break-all' }),
    }),
  });

  // Word-break only applies to paragraph blocks.
  if (!editorState.isParagraph) {
    return null;
  }

  const explicitWordBreak: WordBreakValue | undefined = editorState.isNormal
    ? 'normal'
    : editorState.isBreakAll
      ? 'break-all'
      : undefined;

  // Fall back to the block's default word-break when none is explicitly set.
  const activeWordBreak = explicitWordBreak ?? DEFAULT_WORD_BREAK;

  const activeItem =
    items.find((item) => item.wordBreak === activeWordBreak) ?? items[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="rounded-none w-12">
          <activeItem.icon className="size-4" strokeWidth={2.5} />
          <ChevronDownIcon className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-1 shadow-xl w-40" align="end" noPortal>
        {items.map((item, i) => {
          return (
            <div
              key={i}
              onClick={() =>
                editor.chain().focus().setWordBreak(item.wordBreak).run()
              }
              className="flex space-x-2 items-center rounded-md hover:bg-muted px-2 py-1.5 text-foreground cursor-pointer"
            >
              <item.icon className="size-4" />
              <span className="text-sm">{item.title}</span>
              <div className="flex-1"></div>
              {item.wordBreak === activeWordBreak && (
                <CheckIcon className="size-3.5" />
              )}
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};
