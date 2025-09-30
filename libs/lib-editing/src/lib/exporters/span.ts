import { ExtendedTranslationLanguage, SpanAnnotation } from '@data-access';
import { Exporter, ExporterContext } from './export';
import { SpanMarkType } from '../types';

const SPAN_TYPE_FOR_MARK_TYPE: {
  [key in SpanMarkType]: string;
} = {
  bold: 'text-bold',
  smallCaps: 'small-caps',
  subscript: 'subscript',
  superscript: 'superscript',
  underline: 'underline',
};

export const span: Exporter<SpanAnnotation> = ({
  mark,
  node,
  parent,
  start,
  passageUuid,
}: ExporterContext): SpanAnnotation | undefined => {
  if (!mark) {
    console.warn('Span exporter called without mark');
    return undefined;
  }

  const uuid = mark?.attrs.uuid;

  const textContent = node.textContent || parent.textContent || '';
  const end = start + textContent.length;
  const markType = mark.type.name as SpanMarkType;
  const lang = mark?.attrs.lang as ExtendedTranslationLanguage;
  const textStyle = SPAN_TYPE_FOR_MARK_TYPE[markType] || mark.attrs.textStyle;

  return {
    uuid,
    type: 'span',
    passageUuid,
    start,
    end,
    textStyle,
    lang,
  } as SpanAnnotation;
};
