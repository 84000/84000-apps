import { LineAnnotation } from '@eightyfourthousand/data-access';
import { Exporter } from './export';
import { holdsOnlyAtoms } from './util';

export const line: Exporter<LineAnnotation> = ({
  node,
  start,
  passageUuid,
}): LineAnnotation | undefined => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  // A line holding only inline atoms — a folio reference on its own line —
  // spans no characters but still marks a break, so it persists as a
  // zero-length annotation rather than being dropped.
  if (!textContent && !holdsOnlyAtoms(node)) {
    console.warn(`Line ${uuid} is empty`);
    return undefined;
  }

  return {
    uuid,
    type: 'line',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
