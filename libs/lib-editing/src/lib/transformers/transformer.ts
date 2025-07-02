import { Annotation, Annotations } from '@data-access';
import { BlockEditorContentItem } from '@design-system';

export type BlockEditorContentWithParent = BlockEditorContentItem & {
  parent?: BlockEditorContentWithParent;
};

export type TransformerProps = {
  block: BlockEditorContentWithParent;
  annotation: Annotation;
  childAnnotations?: Annotations;
  transform?: (
    item: BlockEditorContentWithParent,
  ) => BlockEditorContentWithParent[];
};

export type Transformer = (props: TransformerProps) => void;

export const pass = ({ block }: { block: BlockEditorContentWithParent }) =>
  block;

export const printBlock = (block: BlockEditorContentWithParent) => {
  console.log(
    JSON.stringify(
      block,
      (key, value) => (key === 'parent' ? undefined : value),
      2,
    ),
  );
};
