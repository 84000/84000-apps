import { Editor, Extension, Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';

type OnCommandSelect = (props: { editor: Editor; range: Range }) => void;

export interface SuggestionItem {
  title: string;
  description: string;
  keywords: string[];
  command: OnCommandSelect;
}

export interface SlashCommandNodeAttributes {
  command: OnCommandSelect;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SlashCommandOptions<Item extends SuggestionItem = any> {
  /**
   * The suggestion options.
   *
   * @default {}
   * @example { char: '/', pluginKey: slashCommandPluginKey, command: ({editor, range, props}) => { ... } }
   */
  suggestion: Omit<
    SuggestionOptions<Item, SlashCommandNodeAttributes>,
    'editor'
  >;
}

/**
 * The pluging key for the slash command extension.
 * @default 'slashCommand'
 */
export const slashCommandPluginKey = new PluginKey('slashCommand');

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        pluginKey: slashCommandPluginKey,
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        allow: () => {
          // Add exceptions to when the suggestion should not be shown here.
          return true;
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
