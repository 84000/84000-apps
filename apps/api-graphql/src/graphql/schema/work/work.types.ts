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
  /**
   * The live version's uuid, or undefined for a work never published. Work.publishedVersion
   * resolves the label from it; the label itself lives on work_versions.
   */
  publishedVersionUuid?: string;
  pages: number;
  restriction: boolean;
  section: string;
}
