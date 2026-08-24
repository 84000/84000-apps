import {
  BACK_MATTER,
  BODY_MATTER,
  FRONT_MATTER,
  type BodyItemType,
} from '@eightyfourthousand/data-access';
import type { Matter } from './types';

/**
 * Which section of a work a passage type belongs to.
 *
 * `data-access` publishes the three membership lists but no mapping from a
 * type to its section, and every `*Header` type is absent from all three. A
 * header belongs with the section it introduces, so the header suffix is
 * stripped before the lookup; anything still unrecognized is body matter,
 * which is where the reader shows unknown content today.
 */
export const matterForType = (type: BodyItemType): Matter => {
  const base = type.endsWith('Header') ? type.slice(0, -'Header'.length) : type;
  if (FRONT_MATTER.includes(base)) return 'front';
  if (BACK_MATTER.includes(base)) return 'endnotes';
  if (BODY_MATTER.includes(base)) return 'body';
  return 'body';
};
