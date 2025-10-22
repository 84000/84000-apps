import { SupabaseClient } from '@supabase/supabase-js';

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
