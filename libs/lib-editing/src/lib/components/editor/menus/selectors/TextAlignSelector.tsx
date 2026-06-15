'use client';

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@eightyfourthousand/design-system';
import { TextAlignValue } from '@eightyfourthousand/data-access';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  CheckIcon,
  ChevronDownIcon,
  LucideIcon,
} from 'lucide-react';

interface SelectorResult {
  isParagraph: boolean;
  isHeading: boolean;
  isLeft: boolean;
  isCenter: boolean;
  isRight: boolean;
  isJustify: boolean;
}

// When a block has no explicit alignment, the rendered default style is justify
// for paragraphs and center for headings (see TextAlign config + base styles).
const HEADING_DEFAULT_ALIGN: TextAlignValue = 'center';
const PARAGRAPH_DEFAULT_ALIGN: TextAlignValue = 'justify';

const items: { title: string; align: TextAlignValue; icon: LucideIcon }[] = [
  { title: 'Left', align: 'left', icon: AlignLeftIcon },
  { title: 'Center', align: 'center', icon: AlignCenterIcon },
  { title: 'Right', align: 'right', icon: AlignRightIcon },
  { title: 'Justify', align: 'justify', icon: AlignJustifyIcon },
];

export const TextAlignSelector = ({ editor }: { editor: Editor }) => {
  const editorState = useEditorState<SelectorResult>({
    editor,
    selector: (instance) => ({
      isParagraph: instance.editor.isActive('paragraph'),
      isHeading: instance.editor.isActive('heading'),
      isLeft: instance.editor.isActive({ textAlign: 'left' }),
      isCenter: instance.editor.isActive({ textAlign: 'center' }),
      isRight: instance.editor.isActive({ textAlign: 'right' }),
      isJustify: instance.editor.isActive({ textAlign: 'justify' }),
    }),
  });

  // Alignment only applies to paragraph and heading blocks.
  if (!editorState.isParagraph && !editorState.isHeading) {
    return null;
  }

  const explicitAlign: TextAlignValue | undefined = editorState.isLeft
    ? 'left'
    : editorState.isCenter
      ? 'center'
      : editorState.isRight
        ? 'right'
        : editorState.isJustify
          ? 'justify'
          : undefined;

  // Fall back to the block's default alignment when none is explicitly set.
  const defaultAlign = editorState.isHeading
    ? HEADING_DEFAULT_ALIGN
    : PARAGRAPH_DEFAULT_ALIGN;
  const activeAlign = explicitAlign ?? defaultAlign;

  const activeItem =
    items.find((item) => item.align === activeAlign) ?? items[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="rounded-none w-12">
          <activeItem.icon className="size-4" strokeWidth={2.5} />
          <ChevronDownIcon className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-1 shadow-xl w-32" align="end" noPortal>
        {items.map((item, i) => {
          return (
            <div
              key={i}
              onClick={() =>
                editor.chain().focus().setTextAlign(item.align).run()
              }
              className="flex space-x-2 items-center rounded-md hover:bg-muted px-2 py-1.5 text-foreground cursor-pointer"
            >
              <item.icon className="size-4" />
              <span className="text-sm">{item.title}</span>
              <div className="flex-1"></div>
              {item.align === activeAlign && <CheckIcon className="size-3.5" />}
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};
