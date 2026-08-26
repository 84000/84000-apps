import {
  Annotation,
  AnnotationType,
  BodyItemType,
} from '@eightyfourthousand/data-access';
import { TranslationEditorContentItem } from '@eightyfourthousand/data-access';

/**
 * A type a transformed block may carry. These are ProseMirror node names, which
 * mostly match the annotation type but not always — `list` annotations become
 * `bulletList` nodes, so a `until: ['list']` matches nothing.
 */
export type TranslationEditorContentType =
  | AnnotationType
  | BodyItemType
  | 'text'
  | 'bulletList';

export type TransformationContext = {
  root?: TranslationEditorContentItem;
  parent?: TranslationEditorContentItem;
  block: TranslationEditorContentItem;
  annotation: Annotation;
  until?: TranslationEditorContentType[];
};

export type TransformationContextWithCallback = TransformationContext & {
  // A callback may return `true` to signal it fully handled the context and the
  // caller should not perform its default insertion (e.g. mention batching).
  transform?: (ctx: TransformationContext) => void | boolean;
};

export type Transformer = (ctx: TransformationContextWithCallback) => void;

export const pass = () => {
  // nothing to do
};
