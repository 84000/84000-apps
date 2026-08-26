import { LeadingSpaceAnnotation } from '@eightyfourthousand/data-access';
import { Exporter } from './export';
import { parameterAnnotationValue, tohFromAttrs } from '../annotation-attrs';

export const leadingSpace: Exporter<LeadingSpaceAnnotation> = ({
  node,
  start,
  passageUuid,
}): LeadingSpaceAnnotation | undefined => {
  const value = parameterAnnotationValue(node.attrs, 'leadingSpace');
  if (!value) {
    return undefined;
  }

  const toh = tohFromAttrs(value as unknown as Record<string, unknown>);

  return {
    uuid: value.uuid,
    type: 'leadingSpace',
    passageUuid,
    start,
    end: start,
    ...(toh.length ? { toh } : {}),
  };
};
