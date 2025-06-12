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
            parseHTML: (element) => element.getAttribute('uuid'),
            renderHTML: (attributes) => {
              if (!attributes.uuid) {
                attributes.uuid = uuidv4();
              }
              return mergeAttributes(attributes, {
                uuid: attributes.uuid,
              });
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
});
