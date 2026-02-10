/**
 * Type definitions for passage annotation migration scripts.
 */

/**
 * Represents a passage annotation record as stored in the database.
 * Used for upserting migrated annotation data.
 */
export type PassageAnnotationModel = {
  uuid: string;
  created_at: unknown | null;
  passage_uuid: string;
  content: {
    [key: string]: string;
  }[];
  type: string;
  start: unknown;
  end: unknown;
  passage_xmlId: string | null;
  toh: unknown | null;
};

/**
 * Intermediate type used during annotation migration.
 * Extends fetched annotation data with a target UUID field
 * that gets populated by looking up the referenced entity.
 */
export type AnnotationTransformer = {
  annotationUuid: string;
  createdAt: unknown;
  passageUuid: string;
  type: string;
  start: unknown;
  end: unknown;
  targetUuid: string;
  passageXmlId?: string;
  xmlId?: string;
  toh?: unknown | null;
};
