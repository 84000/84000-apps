import { Annotation, AnnotationType, BodyItemType } from '@data-access';
import { BlockEditorContentItem } from '../components/editor';

export type BlockEditorContentType = AnnotationType | BodyItemType | 'text';

export type TransformationContext = {
  root?: BlockEditorContentItem;
  parent?: BlockEditorContentItem;
  block: BlockEditorContentItem;
  annotation: Annotation;
  until?: BlockEditorContentType[];
};

export type TransformationContextWithCallback = TransformationContext & {
  transform?: (ctx: TransformationContext) => void;
};

export type Transformer = (ctx: TransformationContextWithCallback) => void;

export const pass = () => {
  // nothing to do
};
