import { Annotations } from '@data-access';
import { BlockEditorContent } from '@design-system';

export const annotateBlock = (
  block: BlockEditorContent,
  annotations: Annotations,
) => {
  console.log(annotations);
  return block;
};
