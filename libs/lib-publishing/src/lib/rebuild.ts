/**
 * Rebuild / repair.
 *
 * Re-materializes a work's `published_*` rows from a version artifact. This is what
 * makes the artifact canonical in practice rather than in principle: any divergence
 * between the tables and the artifact — corruption, a partial publish, a schema-level
 * mistake — is repairable without republishing and without touching draft state.
 *
 * By default it rebuilds whatever version is currently live, which is the repair case.
 * Naming an older version rebuilds and re-points to that instead, which is a rollback.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { readManifest, verifyManifestHash } from './artifact-storage';
import {
  deleteVersionRows,
  materializeVersion,
  verifyMaterialized,
  type MaterializeCounts,
} from './materialize';
import { resolveWork } from './read-published';

export interface RebuildOptions {
  /** Tohoku number or work uuid. */
  work: string;
  /** Version uuid to rebuild from. Defaults to the live version. */
  versionUuid?: string;
  /**
   * Point the work at the rebuilt version when it is not already live.
   * Required to rebuild a non-live version, so a rollback is always explicit.
   */
  repoint?: boolean;
}

export interface RebuildResult {
  status: 'rebuilt' | 'failed';
  workUuid: string | null;
  versionUuid: string | null;
  version: string | null;
  counts?: MaterializeCounts;
  error?: string;
  warnings: string[];
}

export const rebuildPublishedVersion = async ({
  client,
  options,
}: {
  client: DataClient;
  options: RebuildOptions;
}): Promise<RebuildResult> => {
  const warnings: string[] = [];

  const work = await resolveWork({ client, work: options.work });
  if (!work) {
    return {
      status: 'failed',
      workUuid: null,
      versionUuid: null,
      version: null,
      error: `No work found for "${options.work}".`,
      warnings,
    };
  }

  const versionUuid = options.versionUuid ?? work.publishedVersionUuid;
  if (!versionUuid) {
    return {
      status: 'failed',
      workUuid: work.uuid,
      versionUuid: null,
      version: null,
      error:
        'The work has no live version and no version was named, so there is nothing ' +
        'to rebuild from.',
      warnings,
    };
  }

  const { data: version, error: versionError } = await client
    .from('work_versions')
    .select('uuid, work_uuid, version, artifact_root, artifact_manifest_hash')
    .eq('uuid', versionUuid)
    .maybeSingle();

  if (versionError || !version) {
    return {
      status: 'failed',
      workUuid: work.uuid,
      versionUuid,
      version: null,
      error: `No work_versions row found for ${versionUuid}.`,
      warnings,
    };
  }

  if (version.work_uuid !== work.uuid) {
    return {
      status: 'failed',
      workUuid: work.uuid,
      versionUuid,
      version: version.version,
      error: `Version ${versionUuid} belongs to a different work.`,
      warnings,
    };
  }

  if (!version.artifact_root) {
    return {
      status: 'failed',
      workUuid: work.uuid,
      versionUuid,
      version: version.version,
      error:
        `Version ${version.version} has no artifact_root, so it cannot be rebuilt. ` +
        `This is likely a legacy row that predates artifact-backed publishing.`,
      warnings,
    };
  }

  const isLive = work.publishedVersionUuid === versionUuid;
  if (!isLive && !options.repoint) {
    return {
      status: 'failed',
      workUuid: work.uuid,
      versionUuid,
      version: version.version,
      error:
        `Version ${version.version} is not the live version. Re-run with repoint to ` +
        `roll the work back to it.`,
      warnings,
    };
  }

  try {
    const manifest = await readManifest({ client, root: version.artifact_root });

    if (
      !verifyManifestHash({
        manifest,
        expectedHash: version.artifact_manifest_hash,
      })
    ) {
      return {
        status: 'failed',
        workUuid: work.uuid,
        versionUuid,
        version: version.version,
        error:
          `The artifact manifest does not match the hash recorded on work_versions ` +
          `(${version.artifact_manifest_hash}). Refusing to rebuild from a manifest ` +
          `whose integrity cannot be confirmed.`,
        warnings,
      };
    }

    // Clear whatever is there for this version — corrupted, partial, or complete — so
    // the rebuild is an exact reconstruction rather than a merge over unknown state.
    // While rebuilding the live version this does briefly empty it. That is accepted:
    // the alternative is materializing under a second version uuid, which would change
    // the identity of a version that is already published and referenced.
    await deleteVersionRows({ client, versionUuid });

    const counts = await materializeVersion({
      client,
      root: version.artifact_root,
      manifest,
      workUuid: work.uuid,
      versionUuid,
    });

    const verified = await verifyMaterialized({ client, manifest, versionUuid });
    if (!verified.ok) {
      return {
        status: 'failed',
        workUuid: work.uuid,
        versionUuid,
        version: version.version,
        error: `Rebuilt rows do not match the artifact: ${verified.mismatches.join('; ')}`,
        warnings,
      };
    }

    if (!isLive) {
      const previous = work.publishedVersionUuid;

      const { error: pointerError } = await client
        .from('works')
        .update({ published_version_uuid: versionUuid })
        .eq('uuid', work.uuid);
      if (pointerError) {
        return {
          status: 'failed',
          workUuid: work.uuid,
          versionUuid,
          version: version.version,
          error: `Failed re-pointing the work: ${JSON.stringify(pointerError)}`,
          warnings,
        };
      }

      if (previous) {
        try {
          await deleteVersionRows({ client, versionUuid: previous });
        } catch (error) {
          warnings.push(
            `Re-pointed to ${version.version}, but failed to retire the previously ` +
              `live version's rows (${previous}): ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    return {
      status: 'rebuilt',
      workUuid: work.uuid,
      versionUuid,
      version: version.version,
      counts,
      warnings,
    };
  } catch (error) {
    return {
      status: 'failed',
      workUuid: work.uuid,
      versionUuid,
      version: version.version,
      error: error instanceof Error ? error.message : String(error),
      warnings,
    };
  }
};
