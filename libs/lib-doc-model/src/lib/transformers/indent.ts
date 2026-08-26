import { recurse } from './recurse';
import { Transformer } from './transformer';
import { PARAMETER_ANNOTATIONS, tohAttrs } from '../annotation-attrs';

const SPEC = PARAMETER_ANNOTATIONS.find((spec) => spec.attr === 'indent');

export const indent: Transformer = (ctx) => {
  const { annotation } = ctx;
  recurse({
    ...ctx,
    until: SPEC?.hostTypes,
    transform: ({ block }) => {
      block.attrs = {
        ...block.attrs,
        indent: { uuid: annotation.uuid, ...tohAttrs(annotation) },
      };
    },
  });
};
