import {
  content as basicJsonContent,
  type as basicJsonType,
} from '@lib-editing/fixtures/basic/json';
import { EditorType, Format, Slug } from '@lib-editing/fixtures/types';
import { JSONContent } from '@tiptap/react';

export const SLUG_PATHS: {
  [slug in Slug]: {
    [format in Format]?: { content: JSONContent; type: EditorType };
  };
} = {
  basic: {
    json: {
      content: basicJsonContent,
      type: basicJsonType,
    },
  },
};
