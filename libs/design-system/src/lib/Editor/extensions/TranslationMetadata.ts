import { Extension } from '@tiptap/core';
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
            parseHTML: (element) => element.getAttribute('data-uuid'),
            renderHTML: (attributes) => {
              if (!attributes.uuid) {
                attributes.uuid = uuidv4();
              }
              return { 'data-uuid': attributes.uuid };
            },
          },
          label: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-label'),
            renderHTML: (attributes) => {
              return { 'data-label': attributes.label };
            },
          },
          class: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-class'),
            renderHTML: (attributes) => {
              return { 'data-class': attributes.class };
            },
          },
          type: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-type'),
            renderHTML: (attributes) => {
              return { 'data-type': attributes.type };
            },
          },
          sort: {
            default: 0,
            parseHTML: (element) => element.getAttribute('data-sort'),
            renderHTML: (attributes) => {
              return { 'data-sort': attributes.sort };
            },
          },
        },
      },
    ];
  },
});
