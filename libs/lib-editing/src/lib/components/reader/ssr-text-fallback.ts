import type { JSONContent } from '@tiptap/core';

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'passage',
  'lineGroup',
  'line',
  'list',
  'listItem',
  'blockquote',
  'trailer',
]);

const visit = (node: JSONContent, out: string[]) => {
  if (typeof node.text === 'string') {
    out.push(node.text);
  }

  for (const child of node.content ?? []) {
    visit(child, out);
  }

  if (node.type && BLOCK_TYPES.has(node.type)) {
    out.push('\n\n');
  }
};

export const extractPlainText = (doc: JSONContent): string => {
  const out: string[] = [];
  visit(doc, out);
  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
};
