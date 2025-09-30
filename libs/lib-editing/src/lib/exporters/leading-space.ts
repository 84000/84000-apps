import { LeadingSpaceAnnotation } from '@data-access';
import { Exporter } from './export';

export const leadingSpace: Exporter<LeadingSpaceAnnotation> = ({
  node,
  start,
  passageUuid,
}): LeadingSpaceAnnotation => {
  return {
    uuid: node.attrs.leadingSpaceUuid,
    type: 'leadingSpace',
    passageUuid,
    start,
    end: start,
  };
};
