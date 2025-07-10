import { Extension, mergeAttributes } from '@tiptap/core';

export interface LeadingSpaceOptions {
  types: string[];
  defaultHasLeadingSpace: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    leadingSpace: {
      /**
       * Add a leading space
       */
      setLeadingSpace: () => ReturnType;
      /**
       * Remove a leading space
       */
      unsetLeadingSpace: () => ReturnType;

      /**
       * Toggle a leading space
       */
      toggleLeadingSpace: () => ReturnType;
    };
  }
}

export const LeadingSpace = Extension.create<LeadingSpaceOptions>({
  name: 'leadingSpace',
  addOptions() {
    return {
      types: ['paragraph', 'heading', 'lineGroup'],
      defaultHasLeadingSpace: false,
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          hasLeadingSpace: {
            default: this.options.defaultHasLeadingSpace,
            parseHTML: (element) => element.className.includes('mt-6'),
            renderHTML: (attributes) => {
              if (attributes.hasLeadingSpace) {
                return mergeAttributes(attributes, { class: 'mt-6 no-indent' });
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
      setLeadingSpace:
        () =>
        ({ commands }) => {
          return this.options.types
            .map((type) =>
              commands.updateAttributes(type, { hasLeadingSpace: true }),
            )
            .every((response) => response);
        },
      unsetLeadingSpace:
        () =>
        ({ commands }) => {
          return this.options.types
            .map((type) => commands.resetAttributes(type, 'hasLeadingSpace'))
            .every((response) => response);
        },
      toggleLeadingSpace:
        () =>
        ({ editor, commands }) => {
          if (editor.isActive({ hasLeadingSpace: true })) {
            return commands.unsetLeadingSpace();
          }
          return commands.setLeadingSpace();
        },
    };
  },
});
