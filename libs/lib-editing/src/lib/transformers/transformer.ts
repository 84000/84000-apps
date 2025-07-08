import { Annotation, AnnotationType } from '@data-access';
import { BlockEditorContentItem } from '@design-system';

export type BlockEditorContentType = AnnotationType | 'text';

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
