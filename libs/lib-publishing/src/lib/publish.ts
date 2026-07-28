/**
 * The publish pipeline.
 *
 * Order is the safety property. The pointer flip is the ONLY commit point:
 *
 *   0. refresh glossary_term_index      (else an immutable artifact bakes in stale terms)
 *   1. read draft state
 *   2. validate                          (hard-fail leaves Storage and tables untouched)
 *   3. build the artifact
 *   4. write it to Storage under an immutable key
 *   5. insert work_versions              (inert: nothing points at it yet)
 *   6. materialize published_* FROM the artifact, alongside the live version
 *   7. verify the materialized rows against the artifact
 *   8. flip works.published_version_uuid  <- the new version becomes live, atomically
 *   9. delete the previous version's rows
 *
 * Note that step 5 must precede step 6, contrary to the issue text: every published_*
 * table has a composite foreign key to work_versions(uuid, work_uuid), so the version
 * row has to exist before its snapshot rows can. The safety the issue asked for comes
 * from step 8 being last, not from step 5 being late — a work_versions row nothing
 * points at is invisible to readers.
 *
 * Any failure before step 8 is invisible: the failed version's rows are deleted and the
 * previous version was never touched. A failure between 8 and 9 leaves the old version's
 * rows orphaned but harmless (the pointer is already correct and reads are
 * version-scoped); `gcOrphanedVersions` clears them.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { artifactRoot } from './artifact-keys';
import { readManifest, writeArtifact } from './artifact-storage';
import { buildArtifact } from './build-artifact';
import {
  deleteVersionRows,
  materializeVersion,
  verifyMaterialized,
} from './materialize';
import {
  readDraftWork,
  readVersionLabels,
  refreshGlossaryTermIndex,
  resolveWork,
} from './read-draft';
import { ARTIFACT_BUCKET, type PublishOptions, type PublishResult } from './types';
import { validateDraftWork } from './validate';
import { nextVersion } from './version-label';

const emptyValidation = { ok: true, errors: [], warnings: [] };

export const publishWork = async ({
  client,
  options,
  now,
  newUuid,
}: {
  client: DataClient;
  options: PublishOptions;
  /** Injectable for deterministic tests. */
  now?: () => Date;
  newUuid?: () => string;
}): Promise<PublishResult> => {
  const timestamp = (now ?? (() => new Date()))().toISOString();
  const makeUuid = newUuid ?? (() => crypto.randomUUID());

  const work = await resolveWork({ client, work: options.work });
  if (!work) {
    return {
      status: 'failed',
      workUuid: null,
      versionUuid: null,
      version: null,
      artifactRoot: null,
      manifestHash: null,
      validation: emptyValidation,
      error: `No work found for "${options.work}".`,
    };
  }

  const previousVersionUuid = work.publishedVersionUuid;

  // Step 0. Must happen before reading, not after: the glossary snapshot is permanent.
  await refreshGlossaryTermIndex({ client });

  // Step 1.
  const draft = await readDraftWork({ client, work });

  // Step 2.
  const validation = validateDraftWork(draft);
  if (!validation.ok) {
    return {
      status: 'validation-failed',
      workUuid: work.uuid,
      versionUuid: null,
      version: null,
      artifactRoot: null,
      manifestHash: null,
      validation,
    };
  }

  const existingVersions = await readVersionLabels({
    client,
    workUuid: work.uuid,
  });
  const label = nextVersion({
    existingVersions,
    publicationVersion: work.publicationVersion,
    explicit: options.version,
  });
  if (!label.ok) {
    return {
      status: 'failed',
      workUuid: work.uuid,
      versionUuid: null,
      version: null,
      artifactRoot: null,
      manifestHash: null,
      validation,
      error: label.error,
    };
  }

  // The version uuid is minted here, before anything is written, so the immutable
  // object key is known up front and matches work_versions.uuid exactly.
  const versionUuid = makeUuid();
  const root = artifactRoot({ workUuid: work.uuid, versionUuid });

  // Step 3.
  const built = buildArtifact({
    draft,
    versionUuid,
    version: label.version,
    createdAt: timestamp,
    warnings: validation.warnings,
  });

  if (options.dryRun) {
    return {
      status: 'dry-run',
      workUuid: work.uuid,
      versionUuid,
      version: label.version,
      artifactRoot: root,
      manifestHash: built.manifestHash,
      validation,
      counts: built.counts,
    };
  }

  try {
    // Step 4.
    await writeArtifact({ client, root, files: built.files });

    // Step 5. Inert until step 8.
    const { error: versionError } = await client.from('work_versions').insert({
      uuid: versionUuid,
      work_uuid: work.uuid,
      version: label.version,
      published_at: timestamp,
      published_by: options.publishedBy ?? null,
      notes: options.notes ?? null,
      artifact_bucket: ARTIFACT_BUCKET,
      artifact_root: root,
      artifact_manifest_hash: built.manifestHash,
    });
    if (versionError) {
      throw new Error(
        `Failed inserting work_versions row: ${JSON.stringify(versionError)}`,
      );
    }

    // Step 6. Read back from Storage so the artifact really is the source.
    const manifest = await readManifest({ client, root });
    await materializeVersion({
      client,
      root,
      manifest,
      workUuid: work.uuid,
      versionUuid,
    });

    // Step 7.
    const verified = await verifyMaterialized({ client, manifest, versionUuid });
    if (!verified.ok) {
      throw new Error(
        `Materialized rows do not match the artifact: ${verified.mismatches.join('; ')}`,
      );
    }

    // Step 8. The commit point.
    const { error: pointerError } = await client
      .from('works')
      .update({ published_version_uuid: versionUuid })
      .eq('uuid', work.uuid);
    if (pointerError) {
      throw new Error(
        `Failed flipping published_version_uuid: ${JSON.stringify(pointerError)}`,
      );
    }

    // Step 9. Past the commit point, so a failure here is reported but not fatal: the
    // new version is already live and correct, and the leftovers are collectable.
    if (previousVersionUuid && previousVersionUuid !== versionUuid) {
      try {
        await deleteVersionRows({ client, versionUuid: previousVersionUuid });
      } catch (error) {
        console.error(
          `Published ${label.version} successfully, but failed to retire the previous ` +
            `version's rows (${previousVersionUuid}). Run verify --gc to clean up.`,
          error,
        );
      }
    }

    return {
      status: 'published',
      workUuid: work.uuid,
      versionUuid,
      version: label.version,
      artifactRoot: root,
      manifestHash: built.manifestHash,
      validation,
      counts: built.counts,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const recoveryError = await rollbackFailedPublish({
      client,
      versionUuid,
      workUuid: work.uuid,
    });

    return {
      status: 'failed',
      workUuid: work.uuid,
      versionUuid,
      version: label.version,
      artifactRoot: root,
      manifestHash: built.manifestHash,
      validation,
      error: message,
      recoveryError,
    };
  }
};

/**
 * Undoes a publish that failed before the pointer flip.
 *
 * The live version needs no restoration — it was never modified — so this only removes
 * the failed version's rows and its work_versions row. The artifact objects are left in
 * place: keys are immutable and version-scoped, so an orphaned artifact is inert, and
 * deleting objects on a failure path risks removing something a retry could have reused.
 *
 * Returns an error message when cleanup itself failed, which is the one case a human
 * must look at.
 */
const rollbackFailedPublish = async ({
  client,
  versionUuid,
  workUuid,
}: {
  client: DataClient;
  versionUuid: string;
  workUuid: string;
}): Promise<string | undefined> => {
  try {
    // Guard against the pointer having been flipped: if it somehow points at this
    // version, deleting its rows would empty a live work.
    const { data, error } = await client
      .from('works')
      .select('published_version_uuid')
      .eq('uuid', workUuid)
      .maybeSingle();

    if (error) {
      return `Could not read the live pointer while rolling back: ${JSON.stringify(error)}`;
    }
    if (data?.published_version_uuid === versionUuid) {
      return (
        `Version ${versionUuid} is live despite the publish failing. Left in place ` +
        `rather than deleting rows out from under readers — needs manual review.`
      );
    }

    await deleteVersionRows({ client, versionUuid });

    // Deleting the work_versions row also cascades any rows missed above.
    const { error: versionError } = await client
      .from('work_versions')
      .delete()
      .eq('uuid', versionUuid);
    if (versionError) {
      return `Failed deleting work_versions row ${versionUuid}: ${JSON.stringify(versionError)}`;
    }

    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};
