import { Extension, mergeAttributes } from '@tiptap/react';
import { v4 as uuidv4 } from 'uuid';

export default Extension.create({
  name: 'translationMetadata',
  addGlobalAttributes() {
    const prohibitedNodes = ['text', 'doc'];
    const types = this.extensions
      .filter((extension) => !prohibitedNodes.includes(extension.name))
      .map((extension) => extension.name);

    return [
      {
        // Apply to all node types that the editor has registered
        types,
        attributes: {
          uuid: {
            default: null,
            parseHTML: (element) => element.getAttribute('uuid') || uuidv4(),
            renderHTML: (attributes) => {
              return mergeAttributes(attributes, {
                uuid: attributes.uuid || uuidv4(),
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
        },
      },
    ];
  },
});
