/**
 * The cached per-work publish readiness that backs the editor's diagnostics view.
 *
 * Reading `work_publish_status` rather than validating is not an optimization, it is what
 * makes a corpus-wide view possible at all: validation costs roughly 0.8 ms per passage,
 * so sweeping all 456 works is minutes of database time (see the DEV-718 migration).
 *
 * The cache is ADVISORY. `validate_work_for_publish` runs again inside the publish
 * pipeline and remains the real gate, so nothing here should be used to conclude that a
 * publish will succeed — only to point an editor at work that needs doing.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import type {
  ValidationFinding,
  ValidationResult,
  WorkPublishStatus,
} from './types';
import { isStale } from './types';
import { PAGE_SIZE } from './read-published';

interface WorkPublishStatusRow {
  work_uuid: string;
  ok: boolean | null;
  error_count: number | null;
  warning_count: number | null;
  error_occurrences: number | null;
  warning_occurrences: number | null;
  errors: ValidationFinding[] | null;
  warnings: ValidationFinding[] | null;
  checked_at: string | null;
  draft_touched_at: string;
}

const STATUS_COLUMNS =
  'work_uuid, ok, error_count, warning_count, error_occurrences, warning_occurrences, errors, warnings, checked_at, draft_touched_at';

const fromRow = (row: WorkPublishStatusRow): WorkPublishStatus => ({
  workUuid: row.work_uuid,
  ok: row.ok,
  errorCount: row.error_count ?? 0,
  warningCount: row.warning_count ?? 0,
  errorOccurrences: row.error_occurrences ?? 0,
  warningOccurrences: row.warning_occurrences ?? 0,
  errors: row.errors ?? [],
  warnings: row.warnings ?? [],
  checkedAt: row.checked_at,
  draftTouchedAt: row.draft_touched_at,
  // A verdict recorded before the most recent draft edit describes a state of the work
  // that no longer exists. Callers must render this as unchecked rather than showing the
  // old answer, which is the whole reason draft_touched_at is tracked.
  stale: isStale(row.checked_at, row.draft_touched_at),
});

/**
 * Every cached status row.
 *
 * Works that have never been validated have no row at all, so callers should treat a
 * missing entry and a stale entry the same way: not checked. Returns an empty array on
 * error, so a diagnostics view degrades to "nothing checked yet" rather than failing.
 */
export const readPublishStatuses = async ({
  client,
}: {
  client: DataClient;
}): Promise<WorkPublishStatus[]> => {
  const statuses: WorkPublishStatus[] = [];

  // PostgREST caps every select at 1000 rows, and there is one row per work that has ever
  // been written to, so this pages rather than assuming the corpus stays small.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from('work_publish_status')
      .select(STATUS_COLUMNS)
      .order('work_uuid', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Error reading publish statuses:', error);
      return [];
    }

    const rows = (data ?? []) as WorkPublishStatusRow[];
    statuses.push(...rows.map(fromRow));

    if (rows.length < PAGE_SIZE) {
      return statuses;
    }
  }
};

/**
 * Validates a work and caches the result, returning the live result.
 *
 * This is `validateWork` plus a write: the rules are still `validate_work_for_publish`, so
 * the diagnostics view and the publish gate resolve to one implementation and cannot
 * drift apart.
 *
 * A `glossary-index-unavailable` result is returned but deliberately NOT cached — it means
 * the check could not run, which must stay distinguishable from a work that was checked
 * and found sound.
 */
export const validateAndRecordWork = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<ValidationResult> => {
  const { data, error } = await client.rpc('validate_and_record_work', {
    p_work_uuid: workUuid,
  });

  if (error) {
    throw new Error(`Validation failed to run: ${JSON.stringify(error)}`);
  }

  const result = data as {
    ok: boolean;
    errors: ValidationFinding[];
    warnings: ValidationFinding[];
  };

  return {
    ok: result.ok,
    errors: result.errors ?? [],
    warnings: result.warnings ?? [],
  };
};

/**
 * Where a finding's subject lives, so the diagnostics view can link to it.
 *
 * Findings report subject uuids without saying what they are: passage rules report
 * passages, annotation rules report annotations, and the bibliography rule reports
 * bibliography entries. Resolving that here keeps the rule set — which is the publish
 * gate — free of presentation concerns.
 */
export interface FindingLocation {
  uuid: string;
  kind: 'annotation' | 'passage' | 'bibliography' | 'unknown';
  /** The passage to navigate to. Null for bibliography entries, which have no passage. */
  passageUuid: string | null;
  passageLabel: string | null;
  /** The annotation's type, e.g. `glossary-instance`. Null for other kinds. */
  annotationType: string | null;
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/**
 * Resolves finding subjects to the passage each one sits in.
 *
 * Subjects are scoped to the work rather than looked up globally: a uuid that belongs to
 * another work is not somewhere this editor can navigate, and reporting it as located here
 * would be misleading. Unresolvable subjects come back as `unknown` rather than being
 * dropped, because a finding whose subject has since been deleted is still worth showing.
 */
export const readFindingLocations = async ({
  client,
  workUuid,
  uuids,
}: {
  client: DataClient;
  workUuid: string;
  uuids: string[];
}): Promise<FindingLocation[]> => {
  const unique = [...new Set(uuids)];
  if (unique.length === 0) {
    return [];
  }

  const annotations = new Map<string, { passageUuid: string; type: string }>();
  const passages = new Map<string, string | null>();
  const bibliographies = new Set<string>();

  try {
    // `in` filters go into the URL, so these are chunked to keep the query string within
    // what PostgREST will accept for a work with many findings.
    for (const batch of chunk(unique, 100)) {
      const [annotationRows, passageRows, bibliographyRows] = await Promise.all(
        [
          client
            .from('passage_annotations')
            .select('uuid, type, passage_uuid, passages!inner(work_uuid, label)')
            .in('uuid', batch)
            .eq('passages.work_uuid', workUuid),
          client
            .from('passages')
            .select('uuid, label')
            .in('uuid', batch)
            .eq('work_uuid', workUuid),
          client
            .from('bibliographies')
            .select('uuid')
            .in('uuid', batch)
            .eq('work_uuid', workUuid),
        ],
      );

      if (annotationRows.error || passageRows.error || bibliographyRows.error) {
        console.error(
          'Error resolving finding locations:',
          annotationRows.error ?? passageRows.error ?? bibliographyRows.error,
        );
        return [];
      }

      (annotationRows.data ?? []).forEach((row) => {
        const record = row as unknown as {
          uuid: string;
          type: string;
          passage_uuid: string;
          passages: { label: string | null } | { label: string | null }[];
        };
        const passage = Array.isArray(record.passages)
          ? record.passages[0]
          : record.passages;
        annotations.set(record.uuid, {
          passageUuid: record.passage_uuid,
          type: record.type,
        });
        if (!passages.has(record.passage_uuid)) {
          passages.set(record.passage_uuid, passage?.label ?? null);
        }
      });

      (passageRows.data ?? []).forEach((row) => {
        const record = row as { uuid: string; label: string | null };
        passages.set(record.uuid, record.label);
      });

      (bibliographyRows.data ?? []).forEach((row) => {
        bibliographies.add((row as { uuid: string }).uuid);
      });
    }
  } catch (error) {
    console.error('Error resolving finding locations:', error);
    return [];
  }

  return unique.map((uuid) => {
    const annotation = annotations.get(uuid);
    if (annotation) {
      return {
        uuid,
        kind: 'annotation' as const,
        passageUuid: annotation.passageUuid,
        passageLabel: passages.get(annotation.passageUuid) ?? null,
        annotationType: annotation.type,
      };
    }
    if (passages.has(uuid)) {
      return {
        uuid,
        kind: 'passage' as const,
        passageUuid: uuid,
        passageLabel: passages.get(uuid) ?? null,
        annotationType: null,
      };
    }
    if (bibliographies.has(uuid)) {
      return {
        uuid,
        kind: 'bibliography' as const,
        passageUuid: null,
        passageLabel: null,
        annotationType: null,
      };
    }
    return {
      uuid,
      kind: 'unknown' as const,
      passageUuid: null,
      passageLabel: null,
      annotationType: null,
    };
  });
};
