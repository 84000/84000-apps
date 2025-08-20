import { GlossaryLandingItem } from '@data-access';
import { DataTableRow } from '@design-system';

export type GlossaryInstanceRow = DataTableRow & {
  uuid: string;
  toh: string;
  definition: string;
  canon: string;
  creators: string;
  english: string;
  sanskrit: string;
  tibetan: string;
};

export type GlossariesLandingRow = DataTableRow & GlossaryLandingItem;
