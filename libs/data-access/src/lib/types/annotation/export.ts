import { AnnotationType } from './annotation-type';
import { AnnotationExporter } from './annotation';
import { exporter as abbreviation } from './abbreviation';
import { exporter as audio } from './audio';
import { exporter as blockquote } from './blockquote';
import { exporter as code } from './code';
import { exporter as deprecated } from './deprecated';
import { exporter as endNoteLink } from './end-note-link';
import { exporter as glossaryInstance } from './glossary-instance';
import { exporter as hasAbbreviation } from './has-abbreviation';
import { exporter as heading } from './heading';
import { exporter as image } from './image';
import { exporter as indent } from './indent';
import { exporter as inlineTitle } from './inline-title';
import { exporter as internalLink } from './internal-link';
import { exporter as leadingSpace } from './leading-space';
import { exporter as line } from './line';
import { exporter as lineGroup } from './line-group';
import { exporter as link } from './link';
import { exporter as list } from './list';
import { exporter as listItem } from './list-item';
import { exporter as mantra } from './mantra';
import { exporter as paragraph } from './paragraph';
import { exporter as quote } from './quote';
import { exporter as quoted } from './quoted';
import { exporter as reference } from './reference';
import { exporter as span } from './span';
import { exporter as tableBodyData } from './table-body-data';
import { exporter as tableBodyHeader } from './table-body-header';
import { exporter as tableBodyRow } from './table-body-row';
import { exporter as trailer } from './trailer';
import { exporter as unknown } from './unknown';

export const annotationToDtoMap: Record<AnnotationType, AnnotationExporter> = {
  abbreviation,
  audio,
  blockquote,
  code,
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
  line,
  lineGroup,
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
};
