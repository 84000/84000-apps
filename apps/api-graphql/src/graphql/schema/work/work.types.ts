/**
 * Type for Work parent object in field resolvers
 */
export interface WorkParent {
  uuid: string;
  toh: string[];
  title: string;
  publicationDate: string;
  publicationVersion: string;
  pages: number;
  restriction: boolean;
  section: string;
}
