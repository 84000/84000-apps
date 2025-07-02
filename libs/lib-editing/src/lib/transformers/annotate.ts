import {
  AnnotationType,
  Annotations,
  ExtendedTranslationLanguage,
} from '@data-access';
import type { BlockEditorContentWithParent, Transformer } from './transformer';
import {
  audio,
  abbreviation,
  blockquote,
  deprecated,
  endNoteLink,
  glossaryInstance,
  hasAbbreviation,
  heading,
  image,
  indent,
  inlineTitle,
  internalLink,
  leadingSpace,
  lineGroup,
  line,
  link,
  list,
  listItem,
  mantra,
  paragraph,
  quote,
  quoted,
  reference,
  span,
  tableBodyData,
  tableBodyHeader,
  tableBodyRow,
  trailer,
  unknown,
} from '.';

const TRANSFORMERS: Partial<Record<AnnotationType, Transformer>> = {
  // abbreviation,
  // audio,
  blockquote,
  deprecated,
  endNoteLink,
  glossaryInstance,
  // hasAbbreviation,
  heading,
  indent,
  image,
  inlineTitle,
  internalLink,
  leadingSpace,
  line,
  lineGroup,
  link,
  // list,
  // listItem,
  mantra,
  paragraph,
  quote,
  quoted,
  reference,
  // span,
  // tableBodyData,
  // tableBodyHeader,
  // tableBodyRow,
  trailer,
  unknown,
} as const;

export const ITALIC_LANGUAGES: ExtendedTranslationLanguage[] = [
  'en',
  'Bo-Ltn',
  'Pi-Ltn',
  'Sa-Ltn',
] as const;

export const annotateBlock = (
  block: BlockEditorContentWithParent,
  annotations: Annotations,
) => {
  for (let i = 0; i < annotations.length; i++) {
    const annotation = annotations[i];

    const childAnnotations: Annotations = [];
    const end = annotation.end;

    for (let j = i + 1; j < annotations.length; j++) {
      const nextAnnotation = annotations[j];
      if (nextAnnotation.start > end) {
        break;
      }

      // TODO: nested annotations that extend beyond the current annotation will
      // be truncated. If this is a problem, we need to handle it by appending
      // a new annotation for the remainder.
      nextAnnotation.end = Math.min(nextAnnotation.end, end);
      childAnnotations.push(nextAnnotation);
      i = j;
    }

    const transformer = TRANSFORMERS[annotation.type] || TRANSFORMERS.unknown;
    transformer?.({ block, annotation, childAnnotations });
  }
};
