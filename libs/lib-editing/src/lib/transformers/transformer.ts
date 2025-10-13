import { Annotation, AnnotationType, BodyItemType } from '@data-access';
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
  transform?: (ctx: TransformationContext) => void;
};

export type Transformer = (ctx: TransformationContextWithCallback) => void;

export const pass = () => {
  // nothing to do
};
