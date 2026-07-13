import { Node } from '@tiptap/core';

/**
 * Top node for a single-passage editor: the passage's child blocks are the
 * document, and passage identity (uuid, label, sort, type, toh) lives outside
 * the editor in the stack spine.
 */
export const StackDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+',
});
