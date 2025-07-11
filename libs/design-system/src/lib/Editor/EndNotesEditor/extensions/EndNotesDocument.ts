import { Node } from '@tiptap/core';

export const EndNotesDocument = Node.create({
  name: 'endNotes',
  topNode: true,
  content: 'passage+',
});
