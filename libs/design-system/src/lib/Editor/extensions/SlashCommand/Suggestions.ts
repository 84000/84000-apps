import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  LetterTextIcon,
  ListIcon,
  ListOrderedIcon,
  TextQuoteIcon,
} from 'lucide-react';
import tippy, { Instance } from 'tippy.js';
import { SlashCommandNodeAttributes } from './SlashCommand';
import SuggestionList, {
  CommandSuggestionItem,
  SuggestionListHandle,
  SuggestionListProps,
} from './SuggestionList';
import { SuggestionOptions } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';

type SuggestionType = Omit<
  SuggestionOptions<CommandSuggestionItem, SlashCommandNodeAttributes>,
  'editor'
>;

const baseList: CommandSuggestionItem[] = [
  {
    title: 'Text',
    description: 'Just start typing',
    keywords: ['text', 'paragraph', 'p'],
    icon: LetterTextIcon,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode('paragraph', 'paragraph')
        .run();
    },
  },
  {
    title: 'Heading 1',
    description: 'Big section heading.',
    keywords: ['title', 'big', 'large', 'heading'],
    icon: Heading1Icon,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 1 })
        .run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading.',
    keywords: ['subtitle', 'medium', 'heading'],
    icon: Heading2Icon,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 2 })
        .run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading.',
    keywords: ['subtitle', 'small', 'heading'],
    icon: Heading3Icon,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 3 })
        .run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list.',
    keywords: ['unordered', 'list', 'bullet'],
    icon: ListIcon,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Create a list with numbering.',
    keywords: ['ordered', 'list'],
    icon: ListOrderedIcon,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Quote',
    description: 'Capture a quote.',
    keywords: ['blockquote'],
    icon: TextQuoteIcon,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode('paragraph', 'paragraph')
        .toggleBlockquote()
        .run(),
  },
];

export const getSuggestion = (): SuggestionType => {
  return {
    items: ({ query }) => {
      return baseList.filter((item: CommandSuggestionItem) => {
        return item.keywords.some((kwd) => kwd.startsWith(query.toLowerCase()));
      });
    },
    render: () => {
      let component: ReactRenderer<SuggestionListHandle, SuggestionListProps>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let popup: Instance<any>[];
      return {
        onStart: (props) => {
          component = new ReactRenderer(SuggestionList, {
            props,
            editor: props.editor,
          });

          const clientRect = props.clientRect?.();
          const getReferenceClientRect = clientRect ? () => clientRect : null;
          popup = tippy('body', {
            getReferenceClientRect,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            appendTo: () => document.body,
          });
        },

        onUpdate(props) {
          component.updateProps(props);

          if (!props.clientRect) {
            return;
          }

          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          });
        },

        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            popup[0].hide();
            return true;
          }
          return component.ref?.onKeyDown(props) ?? false;
        },

        onExit() {
          component.destroy();
          popup[0].destroy();
        },
      };
    },
  };
};
