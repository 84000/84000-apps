import { Extension } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

export const TitleMetadata = Extension.create({
  name: 'titleMetadata',
  addGlobalAttributes() {
    return [
      {
        // Apply to all node types that the editor has registered
        types: ['enTitle', 'boTitle', 'boLtnTitle', 'saLtnTitle'],
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
          type: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-type'),
            renderHTML: (attributes) => {
              return { 'data-type': attributes.type };
            },
          },
          language: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-language'),
            renderHTML: (attributes) => {
              return { 'data-language': attributes.language };
            },
          },
        },
      },
    ];
  },
});
