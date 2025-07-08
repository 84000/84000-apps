import { AnnotationType } from '@data-access';
import { Transformer } from './transformer';

export const recurse: Transformer = ({
  root,
  parent,
  block,
  annotation,
  until = [],
  transform,
}) => {
  const type = block.type || 'unknown';
  if (
    block.attrs?.start <= annotation.start &&
    block.attrs?.end >= annotation.end &&
    (!until.length || until.includes(type as AnnotationType))
  ) {
    transform?.({
      root,
      parent,
      block,
      annotation,
    });
    return;
  }

  for (const child of block.content || []) {
    recurse({
      root,
      until,
      parent: block,
      block: child,
      annotation,
      transform,
    });
  }
};
