import { Extension, Node } from '@tiptap/core';
import { mergeAttributes } from '@tiptap/react';
import { CommandSuggestionItem } from '../SlashCommand/SuggestionList';
import { TableIcon } from 'lucide-react';

export interface AbbreviationOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    abbreviationCommand: {
      insertAbbreviation: () => ReturnType;
    };
  }
}

export const AbbreviationCommand = Extension.create({
  name: 'abbreviationCommand',

  addCommands() {
    return {
      insertAbbreviation:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: 'paragraph',
            content: [
              {
                type: 'abbreviation',
                content: [{ type: 'text', text: 'A' }],
              },
              {
                type: 'hasAbbreviation',
                content: [{ type: 'text', text: 'Abbreviation' }],
              },
            ],
          });
        },
    };
  },
});

export const AbbreviationSuggestion: CommandSuggestionItem = {
  title: 'Abbreviation',
  description: 'Insert an abbreviation',
  keywords: ['abbreviation'],
  icon: TableIcon,
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).insertAbbreviation().run();
  },
};

export const Abbreviation = Node.create<AbbreviationOptions>({
  name: 'abbreviation',
  group: 'inline',
  content: 'inline*',
  inline: true,

  addAttributes() {
    return {
      abbreviation: {
        default: undefined,
        parseHTML(element: HTMLElement) {
          return element.getAttribute('abbreviation');
        },
      },
    };
  },

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'italic min-w-8',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[type="abbreviation"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        type: 'abbreviation',
      }),
      0,
    ];
  },
});

export const HasAbbreviation = Node.create<AbbreviationOptions>({
  name: 'hasAbbreviation',
  group: 'inline',
  content: 'inline*',
  inline: true,

  addAttributes() {
    return {
      abbreviation: {
        default: undefined,
        parseHTML(element: HTMLElement) {
          return element.getAttribute('abbreviation');
        },
      },
    };
  },

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [{ tag: 'span[type=hasAbbreviation]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        type: 'hasAbbreviation',
      }),
      0,
    ];
  },
});
