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
      const PAGE_SIZE = 1000;

      // Phase 1: Query passage_annotations for glossary-instance annotations
      let allAnnotations: { passage_uuid: string; content: unknown[] }[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('passage_annotations')
          .select('passage_uuid, content')
          .eq('type', 'glossary-instance')
          .filter(
            'content->0->>uuid',
            'in',
            `(${(glossaryTermUuids as string[]).map((u) => `"${u}"`).join(',')})`,
          )
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
          console.error(
            'Error batch loading glossary passage annotations:',
            error,
          );
          return glossaryTermUuids.map(() => []);
        }

        allAnnotations = allAnnotations.concat(
          (data as { passage_uuid: string; content: unknown[] }[]) ?? [],
        );
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        offset += PAGE_SIZE;
      }

      // Collect unique passage UUIDs and map term UUID -> passage UUIDs
      const termToPassageUuids = new Map<string, Set<string>>();
      const allPassageUuids = new Set<string>();

      for (const annotation of allAnnotations) {
        const content = annotation.content as { uuid?: string }[];
        const termUuid = content?.[0]?.uuid;
        if (!termUuid || !annotation.passage_uuid) continue;

        allPassageUuids.add(annotation.passage_uuid);
        let passageSet = termToPassageUuids.get(termUuid);
        if (!passageSet) {
          passageSet = new Set<string>();
          termToPassageUuids.set(termUuid, passageSet);
        }
        passageSet.add(annotation.passage_uuid);
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
