import { Extension, mergeAttributes } from '@tiptap/core';

export interface TrailerOptions {
  types: string[];
  defaultHasTrailer: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    trailer: {
      /**
       * Add a trailer
       */
      setTrailer: () => ReturnType;
      /**
       * Remove a trailer
       */
      unsetTrailer: () => ReturnType;

      /**
       * Toggle a trailer
       */
      toggleTrailer: () => ReturnType;
    };
  }
}

export const Trailer = Extension.create<TrailerOptions>({
  name: 'trailer',
  addOptions() {
    return {
      types: ['paragraph', 'heading', 'lineGroup'],
      defaultHasTrailer: false,
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          hasTrailer: {
            default: this.options.defaultHasTrailer,
            parseHTML: (element) => element.className.includes('pb-6'),
            renderHTML: (attributes) => {
              if (attributes.hasTrailer) {
                return mergeAttributes(attributes, { class: 'pb-6 no-indent' });
              }

              return {};
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTrailer:
        () =>
        ({ commands }) => {
          return this.options.types
            .map((type) =>
              commands.updateAttributes(type, { hasTrailer: true }),
            )
            .every((response) => response);
        },
      unsetTrailer:
        () =>
        ({ commands }) => {
          return this.options.types
            .map((type) => commands.resetAttributes(type, 'hasTrailer'))
            .every((response) => response);
        },
      toggleTrailer:
        () =>
        ({ editor, commands }) => {
          if (editor.isActive({ hasTrailer: true })) {
            return commands.unsetTrailer();
          }
          return commands.setTrailer();
        },
    };
  },
});
