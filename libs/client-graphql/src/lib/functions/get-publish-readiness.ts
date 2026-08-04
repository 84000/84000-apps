import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

/**
 * One validation finding, as the SQL rule set reports it.
 *
 * `subjects` is capped at 20 per finding while `count` stays the true total, so a view
 * paginates rather than assuming the list is complete.
 */
export interface PublishFinding {
  rule: string;
  severity: string;
  message: string;
  subjects: string[];
  count: number;
}

export interface PublishReadiness {
  ok: boolean;
  errors: PublishFinding[];
  warnings: PublishFinding[];
}

const FINDING_FIELDS = `
  rule
  severity
  message
  subjects
  count
`;

const GET_PUBLISH_READINESS = gql`
  query PublishReadiness($work: String!) {
    publishReadiness(work: $work) {
      ok
      errors { ${FINDING_FIELDS} }
      warnings { ${FINDING_FIELDS} }
    }
  }
`;

interface GetPublishReadinessResponse {
  publishReadiness: PublishReadiness | null;
}

/**
 * Validate a work against the publish rules without publishing it.
 *
 * Runs the same SQL function the publish pipeline runs, so this cannot disagree with the
 * gate. It also caches the verdict for the corpus diagnostics view.
 *
 * Returns null when the work does not exist or the caller lacks `editor.admin`. Note this
 * is a live check: for a very large work it can take tens of seconds.
 */
export async function getPublishReadiness({
  client,
  work,
}: {
  client: GraphQLClient;
  work: string;
}): Promise<PublishReadiness | null> {
  try {
    const response = await client.request<GetPublishReadinessResponse>(
      GET_PUBLISH_READINESS,
      { work },
    );
    return response.publishReadiness;
  } catch (error) {
    console.error('Error fetching publish readiness:', error);
    return null;
  }
}

/**
 * True when the only thing standing between this work and a verdict is an unpopulated
 * `glossary_term_index`.
 *
 * This rule means "could not determine", not "broken work": two glossary rules went
 * unevaluated because the materialized view is empty, which is the normal state of a fresh
 * local stack and of every Supabase preview branch. Only the publish path can refresh it.
 * Presenting it as a validation failure would blame the work for the checker's blind spot.
 */
export const isReadinessUndetermined = (
  readiness: PublishReadiness | null,
): boolean =>
  !!readiness?.errors.some(
    (finding) => finding.rule === 'glossary-index-unavailable',
  );
