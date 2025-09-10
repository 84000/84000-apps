import { Document as TiptapDocument } from '@tiptap/extension-document';

export const Document = TiptapDocument.extend({
  // TODO: support columns, i.e. `(block|columns)+`
  content: 'block+',
});

export default Document;
