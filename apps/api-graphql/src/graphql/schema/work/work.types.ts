/**
 * Type for Work parent object in field resolvers
 */
export interface WorkParent {
  uuid: string;
  toh: string[];
  selectedToh?: string; // The toh selected in the work query (composite key)
  title: string;
  publicationDate: string;
  publicationVersion: string;
  pages: number;
  restriction: boolean;
  section: string;
}
