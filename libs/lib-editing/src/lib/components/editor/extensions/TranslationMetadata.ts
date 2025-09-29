import { Extension, mergeAttributes } from '@tiptap/react';
import { v4 as uuidv4 } from 'uuid';

export default Extension.create({
  name: 'translationMetadata',
  addGlobalAttributes() {
    const prohibitedNodes = ['text', 'doc'];

    return [
      {
        // Apply to all node types that the editor has registered
        types: this.extensions
          .map((extension) => extension.name)
          .filter((name) => !prohibitedNodes.includes(name)),
        attributes: {
          uuid: {
            default: null,
            parseHTML: (element) => element.getAttribute('uuid') || uuidv4(),
            renderHTML: (attributes) => {
              return {
                uuid: attributes.uuid || uuidv4(),
              };
            },
          },
          label: {
            default: null,
            parseHTML: (element) => element.getAttribute('label'),
            renderHTML: (attributes) => {
              return mergeAttributes(attributes, {
                label: attributes.label,
              });
            },
          },
          class: {
            default: null,
            parseHTML: (element) => element.getAttribute('class'),
            renderHTML: (attributes) => {
              return mergeAttributes(attributes, {
                class: attributes.class,
              });
            },
          },
          type: {
            default: null,
            parseHTML: (element) => element.getAttribute('type'),
            renderHTML: (attributes) => {
              return mergeAttributes(attributes, {
                type: attributes.type,
              });
            },
          },
          sort: {
            default: 0,
            parseHTML: (element) => element.getAttribute('sort'),
            renderHTML: (attributes) => {
              return mergeAttributes(attributes, {
                sort: attributes.sort,
              });
            },
          },
        },
      },
    ];
  },
  onTransaction({ transaction }) {
    // if this transaction created a new paragraph, set the uuid to null so it gets a new one
    transaction.steps.forEach((step) => {
      if (!transaction.docChanged) {
        return;
      }
      // @ts-expect-error step.slice is not typed
      if (step.slice?.content) {
        // @ts-expect-error step.jsonID is not typed
        if (step.jsonID !== 'replace' || !step.slice?.content?.length === 2) {
          return;
        }
        // @ts-expect-error step.slice is not typed
        const first = step.slice.content.lastChild;
        // @ts-expect-error step.slice is not typed
        const last = step.slice.content.firstChild;
        if (first?.attrs?.uuid && first?.attrs.uuid === last?.attrs?.uuid) {
          first.attrs.uuid = uuidv4();
        }
      }
    });
  },
});
