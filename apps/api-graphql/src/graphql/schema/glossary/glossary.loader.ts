import DataLoader from 'dataloader';
import type { DataClient } from '@data-access';

export interface GlossaryPassageLocation {
  uuid: string;
  workUuid: string;
  content: string;
  label: string | null;
  sort: number;
  type: string;
  toh: string | null;
  xmlId: string | null;
}

export function createGlossaryPassagesLoader(supabase: DataClient) {
  return new DataLoader<string, GlossaryPassageLocation[]>(
    async (glossaryTermUuids) => {
      // Phase 1: Query passage_annotations via RPC for glossary-instance annotations
      const { data: annotations, error: annotationsError } = await supabase.rpc(
        'get_passage_annotations_by_content_uuids',
        {
          annotation_type: 'glossary-instance',
          target_uuids: glossaryTermUuids as string[],
        },
      );

      if (annotationsError) {
        console.error(
          'Error batch loading glossary passage annotations:',
          annotationsError,
        );
        return glossaryTermUuids.map(() => []);
      }

      // Collect unique passage UUIDs and map term UUID -> passage UUIDs
      const termToPassageUuids = new Map<string, Set<string>>();
      const allPassageUuids = new Set<string>();

      for (const row of (annotations ?? []) as Array<{
        passage_uuid: string;
        target_uuid: string;
      }>) {
        if (!row.target_uuid || !row.passage_uuid) continue;

        allPassageUuids.add(row.passage_uuid);
        let passageSet = termToPassageUuids.get(row.target_uuid);
        if (!passageSet) {
          passageSet = new Set<string>();
          termToPassageUuids.set(row.target_uuid, passageSet);
        }
        passageSet.add(row.passage_uuid);
      }

      // Phase 2: Query passages table for full passage data
      // Batch .in() calls to avoid PostgREST URL length limits
      const passageUuidArray = Array.from(allPassageUuids);
      const passageMap = new Map<string, GlossaryPassageLocation>();
      const IN_BATCH_SIZE = 300;

      for (let i = 0; i < passageUuidArray.length; i += IN_BATCH_SIZE) {
        const batch = passageUuidArray.slice(i, i + IN_BATCH_SIZE);

        const { data, error } = await supabase
          .from('passages')
          .select('uuid, content, label, sort, type, toh, xmlId, work_uuid')
          .in('uuid', batch);

        if (error) {
          console.error('Error batch loading passage data:', error);
          return glossaryTermUuids.map(() => []);
        }

        for (const row of (data ?? []) as Array<{
          uuid: string;
          content: string;
          label: string | null;
          sort: number;
          type: string;
          toh: string | null;
          xmlId: string | null;
          work_uuid: string;
        }>) {
          passageMap.set(row.uuid, {
            uuid: row.uuid,
            workUuid: row.work_uuid,
            content: row.content,
            label: row.label,
            sort: row.sort,
            type: row.type,
            toh: row.toh,
            xmlId: row.xmlId,
          });
        }
      }

      // Build results grouped by glossary term UUID
      return glossaryTermUuids.map((termUuid) => {
        const passageUuids = termToPassageUuids.get(termUuid);
        if (!passageUuids) return [];

        const locations: GlossaryPassageLocation[] = [];
        for (const passageUuid of passageUuids) {
          const passage = passageMap.get(passageUuid);
          if (passage) {
            locations.push(passage);
          }
        }
        return locations;
      });
    },
  );
}
