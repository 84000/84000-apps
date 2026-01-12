'use client';

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@design-system';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  CheckIcon,
  ChevronDownIcon,
  Heading1,
  Heading2,
  Heading3,
  LetterTextIcon,
  ListEndIcon,
  ListStartIcon,
  LucideIcon,
  QuoteIcon,
} from 'lucide-react';

interface SelectorResult {
  isParagraph: boolean;
  isHeading1: boolean;
  isHeading2: boolean;
  isHeading3: boolean;
  isLineGroup: boolean;
  isBlockquote: boolean;
  isTrailer: boolean;
}

interface MenuItem {
  name: string;
  icon: LucideIcon;
  onClick: (editor: Editor) => void;
  isActive: (state: SelectorResult) => boolean;
}

const items: MenuItem[] = [
  {
    name: 'Text',
    icon: LetterTextIcon,
    onClick: (editor) =>
      editor.chain().focus().toggleNode('paragraph', 'paragraph').run(),
    isActive: (state) => state.isParagraph,
  },
  {
    name: 'Heading 1',
    icon: Heading1,
    onClick: (editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (state) => state.isHeading1,
  },
  {
    name: 'Heading 2',
    icon: Heading2,
    onClick: (editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (state) => state.isHeading2,
  },
  {
    name: 'Heading 3',
    icon: Heading3,
    onClick: (editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (state) => state.isHeading3,
  },
  {
    name: 'Line Group',
    icon: ListStartIcon,
    onClick: (editor) => editor.chain().focus().toggleLineGroup().run(),
    isActive: (state) => state.isLineGroup,
  },
  {
    name: 'Quote',
    icon: QuoteIcon,
    onClick: (editor) =>
      editor
        .chain()
        .focus()
        .toggleNode('paragraph', 'paragraph')
        .toggleBlockquote()
        .run(),
    isActive: (state) => state.isBlockquote,
  },
  {
    name: 'Trailer',
    icon: ListEndIcon,
    onClick: (editor) => editor.chain().focus().toggleTrailer().run(),
    isActive: (state) => state.isTrailer,
  },
];

export const TranslationNodeSelector = ({ editor }: { editor: Editor }) => {
  const editorState = useEditorState<SelectorResult>({
    editor,
    selector: (instance) => ({
      isParagraph: instance.editor.isActive('paragraph'),
      isHeading1: instance.editor.isActive('heading', { level: 1 }),
      isHeading2: instance.editor.isActive('heading', { level: 2 }),
      isHeading3: instance.editor.isActive('heading', { level: 3 }),
      isLineGroup: instance.editor.isActive('lineGroup'),
      isBlockquote: instance.editor.isActive('blockquote'),
      isTrailer: instance.editor.isActive('trailer'),
    }),
  });

  const activeItems = items.filter((item) => item.isActive(editorState));

  const name =
    activeItems.length > 1 ? 'Multiple' : (activeItems.pop()?.name ?? 'Text');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="rounded-none">
          <span className="whitespace-nowrap text-sm me-2">{name}</span>
          <ChevronDownIcon className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1 shadow-xl" align="start" noPortal>
        {items.map((item, i) => {
          return (
            <div
              key={i}
              onClick={() => item.onClick(editor)}
              className="flex items-center text-sm rounded-md hover:bg-muted text-foreground px-2 py-1.5 cursor-pointer"
            >
              <item.icon className="size-3.5 me-2" />
              <span>{item.name}</span>
              <div className="flex-1"></div>
              {item.isActive(editorState) && (
                <CheckIcon className="size-3.5 ms-4" />
              )}
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};
