/**
 * A work's publish history, for the editor's publishing view.
 *
 * `work_versions` is the append-only record of publish events, so this is a straight read
 * of it plus three joins the view needs and the table does not carry:
 *
 * - the publisher's display name, which lives in `user_profiles` behind RLS that only
 *   permits self-reads (hence the `publisher_display_names` definer function),
 * - the validation warnings recorded at publish time, which live on the `publish_jobs` row
 *   that created the version rather than on the version itself,
 * - which version is live, which is `works.published_version_uuid`.
 *
 * Read through the REQUESTING user's client, not a service-role one. Reads on
 * `work_versions` are public by policy and the name lookup does its own `editor.admin`
 * check, so nothing here needs elevated credentials.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import type {
  PublishHistory,
  PublishedVersion,
  ValidationFinding,
} from './types';
import { isDraftChangedSincePublish } from './types';
import { PAGE_SIZE, type WorkIdentity } from './read-published';
import { nextVersion } from './version-label';

interface WorkVersionRow {
  uuid: string;
  version: string;
  published_at: string;
  published_by: string | null;
  notes: string | null;
}

const VERSION_COLUMNS = 'uuid, version, published_at, published_by, notes';

/**
 * Every version row for a work, newest first.
 *
 * Pages explicitly: PostgREST caps selects at 1000 rows, and while a work having more than
 * that many versions is not a realistic corpus state, a truncated read here would also
 * truncate the label set the next-version suggestion is computed from — quietly proposing a
 * label that already exists.
 */
const readVersionRows = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<WorkVersionRow[] | null> => {
  const rows: WorkVersionRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('work_versions')
      .select(VERSION_COLUMNS)
      .eq('work_uuid', workUuid)
      .order('published_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error reading work versions:', error);
      return null;
    }

    const batch = (data ?? []) as WorkVersionRow[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      return rows;
    }
  }
};

/**
 * Display names for the given publisher ids.
 *
 * Failure degrades to an empty map rather than failing the history read: not knowing who
 * published a version is a smaller loss than not showing the versions at all. The call
 * raises for a caller without `editor.admin`, which is the definer function refusing to
 * leak profile data — the resolver has already required that permission, so seeing it here
 * means something is calling this that should not be.
 */
const readPublisherNames = async ({
  client,
  ids,
}: {
  client: DataClient;
  ids: string[];
}): Promise<Map<string, string>> => {
  if (!ids.length) {
    return new Map();
  }

  const { data, error } = await client.rpc('publisher_display_names', {
    p_ids: ids,
  });

  if (error) {
    console.error('Error resolving publisher names:', error);
    return new Map();
  }

  const rows = (data ?? []) as { id: string; full_name: string | null }[];
  return new Map(
    rows
      .filter((row): row is { id: string; full_name: string } => !!row.full_name)
      .map((row) => [row.id, row.full_name]),
  );
};

/**
 * When any draft table this work's snapshot draws from was last written.
 *
 * Trigger-maintained on `work_publish_status`, so it exists for any work that has ever been
 * edited and is absent for one that has not. Absent is reported as null rather than as "never
 * touched", because the two are only the same if the triggers have always been in place.
 */
const readDraftTouchedAt = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<string | null> => {
  const { data, error } = await client
    .from('work_publish_status')
    .select('draft_touched_at')
    .eq('work_uuid', workUuid)
    .maybeSingle();

  if (error) {
    console.error('Error reading draft touch time:', error);
    return null;
  }

  return (data as { draft_touched_at: string } | null)?.draft_touched_at ?? null;
};

/**
 * Warnings recorded by the job that created each version, keyed by version uuid.
 *
 * `publish_jobs` deliberately has no foreign key to `work_versions`, so this is a plain
 * lookup on `version_uuid` and a version with no surviving job row gets no entry — which
 * the caller renders as "not recorded" rather than as "no warnings".
 *
 * Only succeeded jobs are read. A failed job's `version_uuid` points at a row the rollback
 * deleted, so it can only match a live version by uuid reuse, which does not happen; the
 * filter is there to keep an abandoned attempt's findings from ever being presented as the
 * published state of a version.
 */
const readVersionWarnings = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<Map<string, ValidationFinding[]>> => {
  const { data, error } = await client
    .from('publish_jobs')
    .select('version_uuid, warnings')
    .eq('work_uuid', workUuid)
    .eq('status', 'succeeded')
    .not('version_uuid', 'is', null);

  if (error) {
    // The versions themselves are still worth showing.
    console.error('Error reading publish job warnings:', error);
    return new Map();
  }

  const rows = (data ?? []) as {
    version_uuid: string;
    warnings: ValidationFinding[] | null;
  }[];
  return new Map(rows.map((row) => [row.version_uuid, row.warnings ?? []]));
};

/**
 * A work's published versions, plus the label a new publish would take.
 *
 * The suggested label comes from `nextVersion` over the same set of labels the snapshot
 * phase reads, so the dialog pre-fills exactly what the pipeline would choose if asked for
 * nothing. Where `nextVersion` refuses to guess — a legacy label that is not SemVer — its
 * reason is passed through instead of a fabricated suggestion.
 *
 * Returns null only when the version read itself failed, which the caller should surface as
 * an error. A work that has never been published is not an error: it yields an empty
 * `versions` list and a suggestion seeded from the legacy `publicationVersion`.
 */
export const readPublishHistory = async ({
  client,
  work,
}: {
  client: DataClient;
  work: WorkIdentity;
}): Promise<PublishHistory | null> => {
  const rows = await readVersionRows({ client, workUuid: work.uuid });
  if (!rows) {
    return null;
  }

  const publisherIds = [
    ...new Set(
      rows
        .map((row) => row.published_by)
        .filter((id): id is string => id !== null),
    ),
  ];

  const [names, warnings, draftTouchedAt] = await Promise.all([
    readPublisherNames({ client, ids: publisherIds }),
    readVersionWarnings({ client, workUuid: work.uuid }),
    readDraftTouchedAt({ client, workUuid: work.uuid }),
  ]);

  const versions: PublishedVersion[] = rows.map((row) => ({
    uuid: row.uuid,
    version: row.version,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    publisher: row.published_by ? names.get(row.published_by) ?? null : null,
    notes: row.notes,
    isLive: row.uuid === work.publishedVersionUuid,
    // `has` rather than `get() ?? []`: an absent job row means the validation status was
    // never recorded, which is not the same as a clean publish.
    warnings: warnings.has(row.uuid) ? (warnings.get(row.uuid) as ValidationFinding[]) : null,
  }));

  const suggestion = nextVersion({
    existingVersions: rows.map((row) => row.version),
    publicationVersion: work.publicationVersion,
  });

  // Compared against the LIVE version rather than the newest row. They are normally the same,
  // but a pointer left on an older version is exactly the case where "has the draft moved on"
  // must be answered about what is actually being served, not about the latest publish.
  const live = versions.find((version) => version.isLive) ?? null;

  return {
    workUuid: work.uuid,
    versions,
    suggestedVersion: suggestion.ok ? suggestion.version : null,
    suggestedVersionError: suggestion.ok ? null : suggestion.error,
    draftTouchedAt,
    draftChangedSincePublish:
      live && draftTouchedAt
        ? isDraftChangedSincePublish(live.publishedAt, draftTouchedAt)
        : null,
  };
};
