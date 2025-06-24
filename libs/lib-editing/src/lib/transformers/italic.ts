import type { Transformer } from './transformer';
import { scan } from './transformer';

export const italic: Transformer = ({ block, annotation }) => {
  return scan({
    block,
    annotation,
    transform: (item) => [
      {
        ...item,
        marks: [...(item.marks || []), { type: 'italic' }],
      },
    ],
  });
};
