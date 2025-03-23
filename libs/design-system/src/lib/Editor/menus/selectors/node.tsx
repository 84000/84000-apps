import { Button } from '../../../Button/Button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../Popover/Popover';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  CheckIcon,
  ChevronDownIcon,
  Heading,
  LetterTextIcon,
  List,
  ListOrdered,
  LucideIcon,
  QuoteIcon,
} from 'lucide-react';

interface SelectorResult {
  isParagraph: boolean;
  isHeading: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isBlockquote: boolean;
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
      editor.chain().focus().toggleNode('translation', 'translation').run(),
    isActive: (state) =>
      state.isParagraph && !state.isBulletList && !state.isOrderedList,
  },
  {
    name: 'Heading',
    icon: Heading,
    onClick: (editor) =>
      editor
        .chain()
        .focus()
        .toggleNode('translationHeader', 'translationHeader')
        .run(),
    isActive: (state) => state.isHeading,
  },
  {
    name: 'Bullet List',
    icon: List,
    onClick: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (state) => state.isBulletList,
  },
  {
    name: 'Numbered List',
    icon: ListOrdered,
    onClick: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (state) => state.isOrderedList,
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
];

export const NodeSelector = ({ editor }: { editor: Editor }) => {
  const editorState = useEditorState<SelectorResult>({
    editor,
    selector: (instance) => ({
      isParagraph:
        instance.editor.isActive('paragraph') ||
        instance.editor.isActive('translation') ||
        instance.editor.isActive('summary') ||
        instance.editor.isActive('text'),
      isHeading:
        instance.editor.isActive('heading') ||
        instance.editor.isActive('translationHeader'),
      isBulletList: instance.editor.isActive('bulletList'),
      isOrderedList: instance.editor.isActive('orderedList'),
      isBlockquote: instance.editor.isActive('blockquote'),
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
              className="flex items-center text-sm rounded-md hover:bg-accent text-accent-foreground px-2 py-1.5 cursor-pointer"
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
