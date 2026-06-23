import { Annotation, AnnotationType, BodyItemType } from '@eightyfourthousand/data-access';
import { TranslationEditorContentItem } from '../components/editor';

export type TranslationEditorContentType =
  | AnnotationType
  | BodyItemType
  | 'text';

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
