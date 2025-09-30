import { mergeAttributes, Node } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

export interface AudioOptions {
  /**
   * HTML attributes to add to the image element.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    audio: {
      /**
       * Set a audio node
       * @param options.updateSelection set to true will select the newly inserted content
       */
      setAudio: (options: { src: string }) => ReturnType;
    };
  }
}

export const Audio = Node.create<AudioOptions>({
  name: 'audio',

  group: 'block',

  addAttributes() {
    return {
      src: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'audio[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'audio',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        controls: true,
        class: 'w-full max-w-xl my-4',
      }),
    ];
  },

  addCommands() {
    return {
      setAudio:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
            uuid: uuidv4(),
          });
        },
    };
  },
});
