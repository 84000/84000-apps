import { createParameterAnnotationExtension } from './parameterAnnotation';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    leadingSpace: {
      /**
       * Add a leading space
       */
      setLeadingSpace: () => ReturnType;
      /**
       * Remove a leading space
       */
      unsetLeadingSpace: () => ReturnType;

      /**
       * Toggle a leading space
       */
      toggleLeadingSpace: () => ReturnType;
    };
  }
}

export const LeadingSpace = createParameterAnnotationExtension({
  name: 'leadingSpace',
  attr: 'leadingSpace',
  types: ['blockquote', 'heading', 'lineGroup', 'paragraph'],
  className: 'mt-6 no-indent',
  dataPrefix: 'leading-space',
});
