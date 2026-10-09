/**
 * A minimal Linear client for filing feedback as issues: one GraphQL mutation
 * over `fetch`, with no SDK dependency.
 *
 * The API key is server-side only. Nothing this module returns carries the key
 * or Linear's own error text; failures are logged on the server and reported
 * to the caller as a bare reason.
 */

/** The three feedback pathways, each filed under its own Linear label. */
export type FeedbackKind = 'feature' | 'bug' | 'feedback';

/** Linear team "AI Translation" (key AIT), where feedback is filed. */
export const AI_TRANSLATION_TEAM_ID = 'e34f3b7b-27d8-4830-b917-7cf69dc3d78c';

/** The AI Translation team's "Backlog" workflow state. */
export const AI_TRANSLATION_BACKLOG_STATE_ID =
  '732b48cd-bd2a-40a7-8480-fdf9ffe67bec';

/** Workspace-level Linear labels, one per pathway. */
export const FEEDBACK_LABEL_IDS: Readonly<Record<FeedbackKind, string>> =
  Object.freeze({
    feature: 'b3aab669-de16-4591-abbc-c10cce7a616a',
    bug: '9faf49a3-9234-4b26-bf0d-7d8072985a61',
    feedback: 'fc13c7cc-dd95-4a17-82cf-5eccabc22d30',
  });

export const LINEAR_GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql';

const DEFAULT_TIMEOUT_MS = 10_000;

/** Where and how feedback issues are filed. */
export interface LinearFeedbackConfig {
  /** Linear API key. When absent, submission fails as `not-configured`. */
  apiKey?: string;
  teamId: string;
  stateId: string;
  labelIds: Readonly<Record<FeedbackKind, string>>;
  /** Overrides the GraphQL endpoint; for tests. */
  endpoint?: string;
  /** Overrides the global `fetch`; for tests. */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds. Defaults to 10 seconds. */
  timeoutMs?: number;
}

const envValue = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * Builds the feedback config from environment variables, falling back to the
 * AI Translation team defaults for everything but the key:
 *
 * - `LINEAR_API_KEY` (required to submit)
 * - `LINEAR_FEEDBACK_TEAM_ID`, `LINEAR_FEEDBACK_STATE_ID`
 * - `LINEAR_FEEDBACK_LABEL_FEATURE`, `LINEAR_FEEDBACK_LABEL_BUG`,
 *   `LINEAR_FEEDBACK_LABEL_FEEDBACK`
 */
export function linearFeedbackConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): LinearFeedbackConfig {
  return {
    apiKey: envValue(env['LINEAR_API_KEY']),
    teamId: envValue(env['LINEAR_FEEDBACK_TEAM_ID']) ?? AI_TRANSLATION_TEAM_ID,
    stateId:
      envValue(env['LINEAR_FEEDBACK_STATE_ID']) ??
      AI_TRANSLATION_BACKLOG_STATE_ID,
    labelIds: {
      feature:
        envValue(env['LINEAR_FEEDBACK_LABEL_FEATURE']) ??
        FEEDBACK_LABEL_IDS.feature,
      bug: envValue(env['LINEAR_FEEDBACK_LABEL_BUG']) ?? FEEDBACK_LABEL_IDS.bug,
      feedback:
        envValue(env['LINEAR_FEEDBACK_LABEL_FEEDBACK']) ??
        FEEDBACK_LABEL_IDS.feedback,
    },
  };
}

/**
 * `unknown` means Linear never confirmed either way, e.g. after a timeout, so
 * the issue may exist. `duplicate` marks an identical report filed earlier.
 */
export type CreateFeedbackIssueResult =
  | { ok: true; identifier: string; url: string; duplicate: boolean }
  | { ok: false; reason: 'not-configured' | 'error' | 'unknown' };

const ISSUE_CREATE_MUTATION = `mutation FeedbackIssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { identifier url }
  }
}`;

const ISSUE_LOOKUP_QUERY = `query FeedbackIssue($id: String!) {
  issue(id: $id) { identifier url }
}`;

type IssueFields = { identifier?: string; url?: string } | null | undefined;

type GraphQLOutcome =
  | { ok: true; data: Record<string, unknown> }
  /**
   * `ambiguous` when the request may have been applied without a reply;
   * `notFound` when Linear answered that the entity does not exist.
   */
  | {
      ok: false;
      ambiguous: boolean;
      notFound?: boolean;
      status?: number;
      detail: string;
    };

/**
 * Derives a UUID v4-shaped issue id from the report, so resubmitting the same
 * report after an unconfirmed attempt finds the first issue instead of filing
 * a second.
 */
export async function feedbackIssueId(
  kind: FeedbackKind,
  title: string,
  description: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([kind, title, description])),
  );
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** One GraphQL request. Never throws, and never puts the key in `detail`. */
async function linearRequest(
  config: LinearFeedbackConfig & { apiKey: string },
  query: string,
  variables: Record<string, unknown>,
): Promise<GraphQLOutcome> {
  const doFetch = config.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(config.endpoint ?? LINEAR_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Linear personal API keys are sent bare, without a `Bearer` prefix.
        Authorization: config.apiKey,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      ambiguous: true,
      detail:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : 'fetch failed',
    };
  }

  let body: { data?: Record<string, unknown> | null; errors?: unknown[] };
  try {
    body = await response.json();
  } catch {
    // A body that fails to arrive or parse on a 2xx may follow a write.
    return {
      ok: false,
      ambiguous: response.status < 400 || response.status >= 500,
      status: response.status,
      detail: `HTTP ${response.status} with an unreadable body`,
    };
  }

  if (!response.ok || body.errors?.length || !body.data) {
    const messages = (body.errors ?? [])
      .map((e) => (e as { message?: string })?.message)
      .filter(Boolean)
      .join('; ')
      .slice(0, 500);
    return {
      ok: false,
      ambiguous: response.status >= 500,
      notFound: response.ok && /\bnot found\b/i.test(messages),
      status: response.status,
      detail: `HTTP ${response.status}${messages ? `: ${messages}` : ''}`,
    };
  }
  return { ok: true, data: body.data };
}

const asIssue = (fields: IssueFields) =>
  fields?.identifier && fields.url
    ? { identifier: fields.identifier, url: fields.url }
    : null;

/**
 * Files one issue in Linear. Never throws: a missing key is `not-configured`,
 * a definite failure is `error`, and an unconfirmed attempt is `unknown`, with
 * the detail kept in the server log. When the create fails, the issue is
 * looked up by its id, so a report that already exists is returned as filed.
 */
export async function createFeedbackIssue(
  config: LinearFeedbackConfig,
  issue: { kind: FeedbackKind; title: string; description: string },
): Promise<CreateFeedbackIssueResult> {
  const { apiKey } = config;
  if (!apiKey) return { ok: false, reason: 'not-configured' };
  const authed = { ...config, apiKey };

  const id = await feedbackIssueId(issue.kind, issue.title, issue.description);
  const created = await linearRequest(authed, ISSUE_CREATE_MUTATION, {
    input: {
      id,
      teamId: config.teamId,
      stateId: config.stateId,
      labelIds: [config.labelIds[issue.kind]],
      title: issue.title,
      description: issue.description,
    },
  });

  let rejected = !created.ok && !created.ambiguous;
  if (created.ok) {
    const payload = created.data['issueCreate'] as
      | { success?: boolean; issue?: IssueFields }
      | null
      | undefined;
    const filed = payload?.success ? asIssue(payload.issue) : null;
    if (filed) return { ok: true, ...filed, duplicate: false };
    rejected = payload?.success === false;
  }

  const existing = await linearRequest(authed, ISSUE_LOOKUP_QUERY, { id });
  const found = existing.ok
    ? asIssue(existing.data['issue'] as IssueFields)
    : null;
  if (found) return { ok: true, ...found, duplicate: true };

  // Report `error` only when nothing can have been filed: the key was refused,
  // or Linear rejected the create and the lookup positively found no issue.
  // Anything less certain is `unknown`.
  const unauthorized =
    !created.ok && (created.status === 401 || created.status === 403);
  const absent = existing.ok
    ? existing.data['issue'] === null
    : existing.notFound === true;
  const definite = unauthorized || (rejected && absent);
  console.error(
    `Linear feedback issue ${id} was ${definite ? 'not created' : 'not confirmed'}: ${
      created.ok ? 'issueCreate did not report success' : created.detail
    }${existing.ok ? '' : `; lookup: ${existing.detail}`}`,
  );
  return { ok: false, reason: definite ? 'error' : 'unknown' };
}
