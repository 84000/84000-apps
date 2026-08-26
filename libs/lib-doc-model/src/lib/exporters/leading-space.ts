import { LeadingSpaceAnnotation } from '@eightyfourthousand/data-access';
import { Exporter } from './export';
import { parameterAnnotationValue } from '../annotation-attrs';

export const leadingSpace: Exporter<LeadingSpaceAnnotation> = ({
  node,
  start,
  passageUuid,
}): LeadingSpaceAnnotation | undefined => {
  const value = parameterAnnotationValue(node.attrs, 'leadingSpace');
  if (!value) {
    return undefined;
  }

  return {
    uuid: value.uuid,
    type: 'leadingSpace',
    passageUuid,
    start,
    end: start,
  };
};
