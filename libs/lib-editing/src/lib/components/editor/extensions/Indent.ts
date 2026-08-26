import { createParameterAnnotationExtension } from './parameterAnnotation';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      /**
       * Add an indent
       */
      setIndent: () => ReturnType;
      /**
       * Remove an indent
       */
      unsetIndent: () => ReturnType;

      /**
       * Toggle an indent
       */
      toggleIndent: () => ReturnType;
    };
  }
}

export const Indent = createParameterAnnotationExtension({
  name: 'indent',
  attr: 'indent',
  // `bulletList` is the list node's real name (tiptap's `BulletList`
  // extended). The previous `'list'` matched no node, so an indent on a list
  // was never declared on the schema and never survived a save.
  types: ['paragraph', 'lineGroup', 'bulletList', 'blockquote'],
  className: 'pl-8',
  dataPrefix: 'indent',
});
