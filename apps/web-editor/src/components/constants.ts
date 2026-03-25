import {
  content as basicJsonContent,
  type as basicJsonType,
} from '@eightyfourthousand/lib-editing/fixtures/basic/json';
import {
  content as toh251JsonContent,
  type as toh251JsonType,
} from '@eightyfourthousand/lib-editing/fixtures/toh251/json';
import {
  content as toh251PassagesContent,
  type as toh251PassagesType,
} from '@eightyfourthousand/lib-editing/fixtures/toh251/passages';

import { EditorType, Format, Slug } from '@eightyfourthousand/lib-editing/fixtures/types';
import { JSONContent } from '@tiptap/react';

export const EMPTY_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [],
};

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
  toh251: {
    json: {
      content: toh251JsonContent,
      type: toh251JsonType,
    },
    passages: {
      content: toh251PassagesContent,
      type: toh251PassagesType,
    },
  },
};
