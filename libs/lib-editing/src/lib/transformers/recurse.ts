import { AnnotationType } from '@data-access';
import { TransformationContextWithCallback, Transformer } from './transformer';

export const recurse: Transformer = (ctx) => {
  if (trasformOnMatch(ctx)) {
    return;
  }

  const { block } = ctx;
  for (const child of block.content || []) {
    if (trasformOnMatch({ ...ctx, parent: block, block: child })) {
      return;
    }

    recurse({
      ...ctx,
      parent: block,
      block: child,
    });
  }
};

const trasformOnMatch = (ctx: TransformationContextWithCallback) => {
  const { block, annotation, until = [], transform } = ctx;
  const type = block.type || 'unknown';
  if (
    block.attrs?.uuid !== annotation.uuid &&
    block.attrs?.start <= annotation.start &&
    block.attrs?.end >= annotation.end &&
    (!until.length || until.includes(type as AnnotationType))
  ) {
    transform?.(ctx);
    return true;
  }

  return false;
};
