import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { PublishFinding } from './get-publish-readiness';

/**
 * One published version of a work.
 *
 * Every version listed has actually been served: `work_versions` is append-only and a
 * failed publish removes its own row.
 */
export interface WorkVersion {
  uuid: string;
  /** SemVer by convention, unique per work. */
  version: string;
  publishedAt: string;
  /** Auth user id; null for a service-account publish. */
  publishedBy: string | null;
  /** Display name, or null when the publish cannot be attributed to a person. */
  publisher: string | null;
  notes: string | null;
  /** Whether readers are currently being served this version. */
  isLive: boolean;
  /**
   * Findings recorded at publish time.
   *
   * `[]` means the publish recorded no warnings; `null` means no job row survives to read,
   * so the validation status is unknown. Do not render null as clean.
   */
  warnings: PublishFinding[] | null;
}

export interface PublishHistory {
  workUuid: string;
  /** Newest first. */
  versions: WorkVersion[];
  /** The label a publish would take if given none. Null when it cannot be inferred. */
  suggestedVersion: string | null;
  /** Why no label could be suggested. Present only when `suggestedVersion` is null. */
  suggestedVersionError: string | null;
  /** Last write to any draft table this work's snapshot draws from. */
  draftTouchedAt: string | null;
  /**
   * Whether the draft has moved on since the live version was published.
   *
   * Null when there is nothing to compare — never published, or no draft write recorded.
   * Must not be rendered as "up to date". Tracks draft writes, not a content diff.
   */
  draftChangedSincePublish: boolean | null;
}

const GET_PUBLISH_HISTORY = gql`
  query PublishHistory($work: String!) {
    publishHistory(work: $work) {
      workUuid
      suggestedVersion
      suggestedVersionError
      draftTouchedAt
      draftChangedSincePublish
      versions {
        uuid
        version
        publishedAt
        publishedBy
        publisher
        notes
        isLive
        warnings {
          rule
          severity
          message
          subjects
          count
        }
      }
    }
  }
`;

interface GetPublishHistoryResponse {
  publishHistory: PublishHistory | null;
}

/**
 * A work's published versions and the label a new publish would take.
 *
 * Requires `editor.admin`. Returns null when the work does not exist, when the caller is
 * not permitted, or on error — all of which a view should render as "history unavailable"
 * rather than as "never published". A work that genuinely has no versions comes back with
 * an empty `versions` array instead.
 */
export async function getPublishHistory({
  client,
  work,
}: {
  client: GraphQLClient;
  work: string;
}): Promise<PublishHistory | null> {
  try {
    const response = await client.request<GetPublishHistoryResponse>(
      GET_PUBLISH_HISTORY,
      { work },
    );
    return response.publishHistory;
  } catch (error) {
    console.error('Error fetching publish history:', error);
    return null;
  }
}
