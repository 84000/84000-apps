import { Annotation } from '@data-access';
import { BlockEditorContentItem } from '@design-system';

export type TransformerProps = {
  block: BlockEditorContentItem;
  annotation: Annotation;
};

export type Transformer = (props: TransformerProps) => BlockEditorContentItem;
