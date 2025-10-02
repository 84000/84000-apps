import { Exporter, ExporterContext } from './export';
import {
  AnnotationType,
  ExtendedTranslationLanguage,
  InlineTitleAnnotation,
  MantraAnnotation,
  SpanAnnotation,
} from '@data-access';

export const italic: Exporter<
  InlineTitleAnnotation | MantraAnnotation | SpanAnnotation
> = ({
  mark,
  node,
  parent,
  start,
  passageUuid,
}: ExporterContext):
  | InlineTitleAnnotation
  | MantraAnnotation
  | SpanAnnotation
  | undefined => {
  if (!mark) {
    console.warn('Italic exporter called without mark');
    return undefined;
  }

  const uuid = mark?.attrs.uuid;
  const type = mark?.attrs.type as AnnotationType;
  const textContent = node.textContent || parent.textContent || '';
  const textStyle = (mark?.attrs.textStyle as string) || 'emphasis';
  const lang = mark?.attrs.lang as ExtendedTranslationLanguage;
  const end = start + textContent.length;

  switch (type) {
    case 'inlineTitle':
      return {
        uuid,
        type: 'inlineTitle',
        passageUuid,
        start,
        end,
        lang,
      } as InlineTitleAnnotation;
    case 'mantra':
      return {
        uuid,
        type: 'mantra',
        passageUuid,
        start,
        end,
        lang,
      } as MantraAnnotation;
    default:
      return {
        uuid,
        type: 'span',
        passageUuid,
        start,
        end,
        textStyle,
      } as SpanAnnotation;
  }
};
