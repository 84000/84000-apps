/**
 * Fetch utilities for passage annotation queries.
 *
 * Provides paginated fetching of passage annotations from Supabase
 * with flexible filtering by annotation type and content structure.
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetches a page of passage annotations that need migration.
 *
 * Queries the `passage_annotations` table for records that:
 * - Match the specified annotation type
 * - Have a non-null value at the specified content path (need migration)
 * - Have a null value at the null check path (not yet migrated)
 *
 * @param supabase - Authenticated Supabase client
 * @param type - Annotation type to filter by (e.g., 'glossary-instance', 'end-note-link')
 * @param contentType - JSON key to extract from content array (e.g., 'glossary_xmlId')
 * @param contentIndex - Index in content array to read from (default: 0)
 * @param nullType - JSON key to check for null (indicates unmigrated record)
 * @param nullIndex - Index in content array for null check (default: 0)
 * @param limit - Maximum number of records to fetch per page
 * @returns Supabase query result with annotation data
 */
export const fetchPage = async ({
  supabase,
  type,
  contentType,
  contentIndex = 0,
  nullType = 'uuid',
  nullIndex = 0,
  limit,
}: {
  supabase: SupabaseClient;
  type: string;
  contentType: string;
  contentIndex?: 0 | 1;
  nullType?: string;
  nullIndex?: 0 | 1;
  limit: number;
}) => {
  return await supabase
    .from('passage_annotations')
    .select(
      `
        annotationUuid:uuid::text,
        createdAt:created_at,
        passageUuid:passage_uuid::text,
        type:type::text,
        start,
        end,
        toh,
        passageXmlId:"passage_xmlId"::text,
        xmlId:content->${contentIndex}->>"${contentType}"::text
      `,
    )
    .eq('type', type)
    .is(`content->${nullIndex}->>"${nullType}"`, null)
    .not(`content->${contentIndex}->>"${contentType}"`, 'is', null)
    .limit(limit);
};
