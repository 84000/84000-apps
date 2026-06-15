'use client';

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@eightyfourthousand/design-system';
import { WhitespaceValue } from '@eightyfourthousand/data-access';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  ArrowRightToLineIcon,
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  LucideIcon,
  MoveHorizontalIcon,
  PilcrowIcon,
  TextIcon,
  WrapTextIcon,
} from 'lucide-react';

interface SelectorResult {
  isParagraph: boolean;
  isNormal: boolean;
  isNowrap: boolean;
  isPre: boolean;
  isPreWrap: boolean;
  isPreLine: boolean;
  isBreakSpaces: boolean;
}

// When a paragraph has no explicit white-space, the rendered default is the CSS
// default `normal`.
const DEFAULT_WHITESPACE: WhitespaceValue = 'normal';

const items: {
  title: string;
  whitespace: WhitespaceValue;
  icon: LucideIcon;
}[] = [
  { title: 'Normal', whitespace: 'normal', icon: WrapTextIcon },
  { title: 'No wrap', whitespace: 'nowrap', icon: MoveHorizontalIcon },
  { title: 'Preformatted', whitespace: 'pre', icon: CodeIcon },
  { title: 'Preserve & wrap', whitespace: 'pre-wrap', icon: PilcrowIcon },
  { title: 'Preserve lines', whitespace: 'pre-line', icon: TextIcon },
  {
    title: 'Break spaces',
    whitespace: 'break-spaces',
    icon: ArrowRightToLineIcon,
  },
];

export const WhitespaceSelector = ({ editor }: { editor: Editor }) => {
  const editorState = useEditorState<SelectorResult>({
    editor,
    selector: (instance) => ({
      isParagraph: instance.editor.isActive('paragraph'),
      isNormal: instance.editor.isActive({ whitespace: 'normal' }),
      isNowrap: instance.editor.isActive({ whitespace: 'nowrap' }),
      isPre: instance.editor.isActive({ whitespace: 'pre' }),
      isPreWrap: instance.editor.isActive({ whitespace: 'pre-wrap' }),
      isPreLine: instance.editor.isActive({ whitespace: 'pre-line' }),
      isBreakSpaces: instance.editor.isActive({ whitespace: 'break-spaces' }),
    }),
  });

  // White-space only applies to paragraph blocks.
  if (!editorState.isParagraph) {
    return null;
  }

  const explicitWhitespace: WhitespaceValue | undefined = editorState.isNormal
    ? 'normal'
    : editorState.isNowrap
      ? 'nowrap'
      : editorState.isPre
        ? 'pre'
        : editorState.isPreWrap
          ? 'pre-wrap'
          : editorState.isPreLine
            ? 'pre-line'
            : editorState.isBreakSpaces
              ? 'break-spaces'
              : undefined;

  // Fall back to the block's default white-space when none is explicitly set.
  const activeWhitespace = explicitWhitespace ?? DEFAULT_WHITESPACE;

  const activeItem =
    items.find((item) => item.whitespace === activeWhitespace) ?? items[0];

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
                editor.chain().focus().setWhitespace(item.whitespace).run()
              }
              className="flex space-x-2 items-center rounded-md hover:bg-muted px-2 py-1.5 text-foreground cursor-pointer"
            >
              <item.icon className="size-4" />
              <span className="text-sm">{item.title}</span>
              <div className="flex-1"></div>
              {item.whitespace === activeWhitespace && (
                <CheckIcon className="size-3.5" />
              )}
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};
