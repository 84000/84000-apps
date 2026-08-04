import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { PublishFinding } from './get-publish-readiness';

/**
 * A work's cached publish readiness.
 *
 * Advisory. The publish pipeline revalidates, so this shows where cleanup is needed, never
 * that a publish will succeed.
 */
export interface WorkPublishStatus {
  workUuid: string;
  /** Null when never checked — which is not the same as publishable. */
  ok: boolean | null;
  /** Distinct rules that fired, as opposed to occurrences. */
  errorCount: number;
  warningCount: number;
  /** True totals, which exceed the capped `subjects` arrays. */
  errorOccurrences: number;
  warningOccurrences: number;
  errors: PublishFinding[];
  warnings: PublishFinding[];
  checkedAt: string | null;
  draftTouchedAt: string;
  /** The draft changed after the verdict was recorded. */
  stale: boolean;
}

const GET_PUBLISH_STATUSES = gql`
  query PublishStatuses {
    publishStatuses {
      workUuid
      ok
      errorCount
      warningCount
      errorOccurrences
      warningOccurrences
      checkedAt
      draftTouchedAt
      stale
    }
  }
`;

interface GetPublishStatusesResponse {
  publishStatuses: WorkPublishStatus[];
}

/**
 * Cached readiness for every work that has been written to.
 *
 * Findings themselves are deliberately not requested here — the corpus view needs counts,
 * and pulling every finding for hundreds of works would move a lot of data to render a
 * status column. The per-work view fetches the detail.
 *
 * A work missing from the result has never been checked. Returns an empty array on error,
 * so the diagnostics view degrades to "nothing checked yet" rather than failing.
 */
export async function getPublishStatuses({
  client,
}: {
  client: GraphQLClient;
}): Promise<WorkPublishStatus[]> {
  try {
    const response = await client.request<GetPublishStatusesResponse>(
      GET_PUBLISH_STATUSES,
    );
    return (response.publishStatuses ?? []).map((status) => ({
      ...status,
      errors: status.errors ?? [],
      warnings: status.warnings ?? [],
    }));
  } catch (error) {
    console.error('Error fetching publish statuses:', error);
    return [];
  }
}

/**
 * How a work's status should be presented.
 *
 * `unchecked` covers both "no row" and "row predating the latest edit". Collapsing those
 * is deliberate: in both cases there is no verdict that describes the work as it stands
 * now, and showing a superseded answer is the one failure this feature must avoid.
 */
export type PublishStatusKind =
  | 'publishable'
  | 'blocked'
  | 'unchecked'
  | 'outdated';

export const publishStatusKind = (
  status: WorkPublishStatus | undefined,
): PublishStatusKind => {
  if (!status || status.checkedAt === null) {
    return 'unchecked';
  }
  if (status.stale) {
    return 'outdated';
  }
  return status.ok ? 'publishable' : 'blocked';
};
