import { Extension } from '@tiptap/core';
import { mergeAttributes } from '@tiptap/react';
import { TableCell } from '../Table';
import { CommandSuggestionItem } from '../SlashCommand/SuggestionList';
import { TableIcon } from 'lucide-react';

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
            type: 'table',
            content: [
              {
                type: 'tableRow',
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

export const AbbreviationCell = TableCell.extend({
  name: 'abbreviation',
  group: 'tableCell',
  content: 'inline*',
  parseHTML() {
    return [{ tag: 'td[type=abbreviation]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      'td',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        type: 'abbreviation',
        class: 'italic',
      }),
      0,
    ];
  },
});

export const HasAbbreviationCell = TableCell.extend({
  name: 'hasAbbreviation',
  group: 'tableCell',
  content: 'inline*',
  parseHTML() {
    return [{ tag: 'td[type=hasAbbreviation]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      'td',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        type: 'hasAbbreviation',
      }),
      0,
    ];
  },
});
