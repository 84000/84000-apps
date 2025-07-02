import { recurse } from './recurse';
import { Transformer } from './transformer';

export const line: Transformer = ({
  block,
  annotation,
  childAnnotations = [],
}) => {
  recurse({
    block,
    annotation,
    childAnnotations,
    transform: (item) => {
      item.type = 'line';
      return [item];
    },
  });
};
