import DataLoader from 'dataloader';
import { passageFromDTO, type DataClient, type Passage, type PassageDTO, type Passages } from '@data-access';

export function createPassageReferencesLoader(supabase: DataClient) {
  return new DataLoader<string, Passages>(
    async (passageUuids) => {
      // Phase 1: Query passage_annotations via RPC for end-note-link annotations
      // Here, target_uuids are the endnote passage UUIDs we want to find references FOR
      const { data: annotations, error: annotationsError } = await supabase.rpc(
        'get_passage_annotations_by_content_uuids',
        {
          annotation_type: 'end-note-link',
          target_uuids: passageUuids as string[],
        },
      );

      if (annotationsError) {
        console.error(
          'Error batch loading passage reference annotations:',
          annotationsError,
        );
        return passageUuids.map(() => []);
      }

      // Collect unique source passage UUIDs and map target UUID -> source passage UUIDs
      const targetToSourceUuids = new Map<string, Set<string>>();
      const allSourceUuids = new Set<string>();

      for (const row of (annotations ?? []) as Array<{
        passage_uuid: string;
        target_uuid: string;
      }>) {
        if (!row.target_uuid || !row.passage_uuid) continue;

        allSourceUuids.add(row.passage_uuid);
        let sourceSet = targetToSourceUuids.get(row.target_uuid);
        if (!sourceSet) {
          sourceSet = new Set<string>();
          targetToSourceUuids.set(row.target_uuid, sourceSet);
        }
        sourceSet.add(row.passage_uuid);
      }

      // Phase 2: Query passages table for full passage data
      const sourceUuidArray = Array.from(allSourceUuids);
      const passageMap = new Map<string, Passage>();
      const IN_BATCH_SIZE = 300;

      for (let i = 0; i < sourceUuidArray.length; i += IN_BATCH_SIZE) {
        const batch = sourceUuidArray.slice(i, i + IN_BATCH_SIZE);

        const { data, error } = await supabase
          .from('passages')
          .select('uuid, content, label, sort, type, toh, xmlId, work_uuid')
          .in('uuid', batch);

        if (error) {
          console.error('Error batch loading passage reference data:', error);
          return passageUuids.map(() => []);
        }

        for (const row of (data ?? []) as Array<PassageDTO>) {
          passageMap.set(row.uuid, passageFromDTO(row));
        }
      }

      // Build results grouped by target passage UUID
      return passageUuids.map((targetUuid) => {
        const sourceUuids = targetToSourceUuids.get(targetUuid);
        if (!sourceUuids) return [];

        const references: Passages = [];
        for (const sourceUuid of sourceUuids) {
          const passage = passageMap.get(sourceUuid);
          if (passage) {
            references.push(passage);
          }
        }
        return references.sort((a, b) => a.sort - b.sort);
      });
    },
  );
}
