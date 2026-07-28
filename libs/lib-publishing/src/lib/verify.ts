/**
 * Health checks over the published serving layer.
 *
 * The invariant for a settled work is simple: every `published_*` row's `version_uuid`
 * equals `works.published_version_uuid`. Rows under any other version are either an
 * in-flight publish or leftovers from one that failed between the pointer flip and the
 * retirement of the old version.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { deleteVersionRows } from './materialize';

const PUBLISHED_TABLES = [
  'published_passages',
  'published_passage_annotations',
  'published_glossaries',
  'published_bibliographies',
] as const;

export interface OrphanedVersion {
  versionUuid: string;
  workUuid: string;
  version: string | null;
  rowCounts: Record<string, number>;
}

export interface VerifyResult {
  ok: boolean;
  /** Works whose live version has no snapshot rows at all. */
  emptyLiveVersions: { workUuid: string; versionUuid: string }[];
  /** Versions holding rows while not being the live version. */
  orphaned: OrphanedVersion[];
  collected: string[];
}

const countRows = async ({
  client,
  table,
  versionUuid,
}: {
  client: DataClient;
  table: string;
  versionUuid: string;
}): Promise<number> => {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('version_uuid', versionUuid);

  if (error) {
    console.error(`Error counting ${table} for ${versionUuid}:`, error);
    return 0;
  }
  return count ?? 0;
};

/**
 * Reports versions whose rows are not live, optionally deleting them.
 *
 * Scoped to one work when `work` is given; otherwise it sweeps every work that has ever
 * published. `gc` only removes rows for versions that are not live, so it can never
 * empty a served work.
 */
export const verifyPublished = async ({
  client,
  workUuid,
  gc = false,
}: {
  client: DataClient;
  workUuid?: string;
  gc?: boolean;
}): Promise<VerifyResult> => {
  const versionQuery = client
    .from('work_versions')
    .select('uuid, work_uuid, version');

  const { data: versions, error: versionsError } = workUuid
    ? await versionQuery.eq('work_uuid', workUuid)
    : await versionQuery;

  if (versionsError) {
    console.error('Error listing work_versions:', versionsError);
    return { ok: false, emptyLiveVersions: [], orphaned: [], collected: [] };
  }

  const workUuids = [...new Set((versions ?? []).map((row) => row.work_uuid))];
  const pointers = new Map<string, string | null>();

  for (const uuid of workUuids) {
    const { data, error } = await client
      .from('works')
      .select('published_version_uuid')
      .eq('uuid', uuid)
      .maybeSingle();

    if (error) {
      console.error(`Error reading pointer for work ${uuid}:`, error);
      continue;
    }
    pointers.set(uuid, data?.published_version_uuid ?? null);
  }

  const orphaned: OrphanedVersion[] = [];
  const emptyLiveVersions: { workUuid: string; versionUuid: string }[] = [];
  const collected: string[] = [];

  for (const version of versions ?? []) {
    const live = pointers.get(version.work_uuid) ?? null;

    const rowCounts: Record<string, number> = {};
    let total = 0;
    for (const table of PUBLISHED_TABLES) {
      const count = await countRows({
        client,
        table,
        versionUuid: version.uuid,
      });
      rowCounts[table] = count;
      total += count;
    }

    if (version.uuid === live) {
      if (total === 0) {
        emptyLiveVersions.push({
          workUuid: version.work_uuid,
          versionUuid: version.uuid,
        });
      }
      continue;
    }

    if (total === 0) {
      // A historical version with no rows is the expected steady state.
      continue;
    }

    orphaned.push({
      versionUuid: version.uuid,
      workUuid: version.work_uuid,
      version: version.version,
      rowCounts,
    });

    if (gc) {
      try {
        await deleteVersionRows({ client, versionUuid: version.uuid });
        collected.push(version.uuid);
      } catch (error) {
        console.error(`Failed collecting version ${version.uuid}:`, error);
      }
    }
  }

  return {
    ok: emptyLiveVersions.length === 0 && orphaned.length === 0,
    emptyLiveVersions,
    orphaned,
    collected,
  };
};
