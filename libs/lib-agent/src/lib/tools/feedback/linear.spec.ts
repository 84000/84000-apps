/**
 * @jest-environment node
 */
import {
  AI_TRANSLATION_BACKLOG_STATE_ID,
  AI_TRANSLATION_TEAM_ID,
  FEEDBACK_LABEL_IDS,
  LINEAR_GRAPHQL_ENDPOINT,
  createFeedbackIssue,
  feedbackIssueId,
  linearFeedbackConfigFromEnv,
} from './linear';
import type { LinearFeedbackConfig } from './linear';

const API_KEY = 'lin_api_secret_value';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const notFound = () =>
  jsonResponse({
    errors: [{ message: 'Entity not found: Issue' }],
    data: null,
  });

const existing = {
  data: {
    issue: { identifier: 'AIT-0', url: 'https://linear.app/84000/AIT-0' },
  },
};

const created = {
  data: {
    issueCreate: {
      success: true,
      issue: { identifier: 'AIT-1', url: 'https://linear.app/84000/AIT-1' },
    },
  },
};

describe('linearFeedbackConfigFromEnv', () => {
  it('defaults to the AI Translation backlog and workspace labels', () => {
    expect(linearFeedbackConfigFromEnv({})).toEqual({
      apiKey: undefined,
      teamId: AI_TRANSLATION_TEAM_ID,
      stateId: AI_TRANSLATION_BACKLOG_STATE_ID,
      labelIds: FEEDBACK_LABEL_IDS,
    });
  });

  it('reads the key and overrides, ignoring blank values', () => {
    const config = linearFeedbackConfigFromEnv({
      LINEAR_API_KEY: ` ${API_KEY} `,
      LINEAR_FEEDBACK_TEAM_ID: 'team',
      LINEAR_FEEDBACK_STATE_ID: '  ',
      LINEAR_FEEDBACK_LABEL_BUG: 'bug-label',
    });

    expect(config.apiKey).toBe(API_KEY);
    expect(config.teamId).toBe('team');
    expect(config.stateId).toBe(AI_TRANSLATION_BACKLOG_STATE_ID);
    expect(config.labelIds).toEqual({
      ...FEEDBACK_LABEL_IDS,
      bug: 'bug-label',
    });
  });
});

describe('createFeedbackIssue', () => {
  const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
  const config: LinearFeedbackConfig = {
    ...linearFeedbackConfigFromEnv({ LINEAR_API_KEY: API_KEY }),
    fetch: fetchMock as unknown as typeof fetch,
  };
  const issue = { kind: 'bug' as const, title: 'T', description: 'D' };
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    fetchMock.mockReset();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {
      /* silenced */
    });
  });

  afterEach(() => consoleError.mockRestore());

  const loggedText = () => consoleError.mock.calls.flat().join(' ');

  it('is not-configured without a key, and makes no request', async () => {
    const result = await createFeedbackIssue(
      { ...config, apiKey: undefined },
      issue,
    );

    expect(result).toEqual({ ok: false, reason: 'not-configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('files the issue in the configured team, state and label', async () => {
    fetchMock.mockResolvedValue(jsonResponse(created));

    const result = await createFeedbackIssue(config, issue);

    expect(result).toEqual({
      ok: true,
      identifier: 'AIT-1',
      url: 'https://linear.app/84000/AIT-1',
      duplicate: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(LINEAR_GRAPHQL_ENDPOINT);
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Authorization']).toBe(
      API_KEY,
    );
    const body = JSON.parse(init?.body as string);
    expect(body.query).toContain('issueCreate');
    expect(body.variables.input).toEqual({
      id: await feedbackIssueId('bug', 'T', 'D'),
      teamId: AI_TRANSLATION_TEAM_ID,
      stateId: AI_TRANSLATION_BACKLOG_STATE_ID,
      labelIds: [FEEDBACK_LABEL_IDS.bug],
      title: 'T',
      description: 'D',
    });
  });

  it.each([
    ['feature', FEEDBACK_LABEL_IDS.feature],
    ['feedback', FEEDBACK_LABEL_IDS.feedback],
  ] as const)('labels %s with its own label', async (kind, label) => {
    fetchMock.mockResolvedValue(jsonResponse(created));

    await createFeedbackIssue(config, { ...issue, kind });

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.variables.input.labelIds).toEqual([label]);
  });

  it.each([
    [
      'a GraphQL error',
      () =>
        jsonResponse({
          errors: [{ message: 'Entity not found: Team' }],
          data: null,
        }),
    ],
    [
      'an HTTP error',
      () => jsonResponse({ errors: [{ message: 'Authentication' }] }, 401),
    ],
    [
      'an unsuccessful mutation',
      () => jsonResponse({ data: { issueCreate: { success: false } } }),
    ],
  ])('reports a bare error on %s', async (_label, respond) => {
    fetchMock
      .mockResolvedValueOnce(respond())
      .mockResolvedValueOnce(notFound());

    const result = await createFeedbackIssue(config, issue);

    expect(result).toEqual({ ok: false, reason: 'error' });
    expect(consoleError).toHaveBeenCalled();
    expect(loggedText()).not.toContain(API_KEY);
  });

  it.each([
    ['the request throws', () => Promise.reject(new Error('network down'))],
    [
      'the request times out',
      () =>
        Promise.reject(
          new DOMException('The operation timed out.', 'TimeoutError'),
        ),
    ],
    [
      'Linear returns a 5xx',
      () => Promise.resolve(new Response('<html>', { status: 502 })),
    ],
  ])('reports an unknown outcome when %s', async (_label, respond) => {
    fetchMock.mockImplementationOnce(respond).mockResolvedValueOnce(notFound());

    const result = await createFeedbackIssue(config, issue);

    expect(result).toEqual({ ok: false, reason: 'unknown' });
    expect(loggedText()).toMatch(/not confirmed/);
    expect(loggedText()).not.toContain(API_KEY);
  });

  it.each([
    [
      'a 200 whose body cannot be read',
      () => Promise.resolve(new Response('{"data":', { status: 200 })),
      notFound,
    ],
    [
      'a success without the issue fields',
      () =>
        Promise.resolve(
          jsonResponse({ data: { issueCreate: { success: true } } }),
        ),
      notFound,
    ],
    [
      'a rejected create whose lookup times out',
      () =>
        Promise.resolve(
          jsonResponse({ errors: [{ message: 'id already exists' }] }),
        ),
      () => {
        throw new DOMException('The operation timed out.', 'TimeoutError');
      },
    ],
  ])('stays unknown on %s', async (_label, respondCreate, respondLookup) => {
    fetchMock
      .mockImplementationOnce(respondCreate)
      .mockImplementationOnce(async () => respondLookup());

    const result = await createFeedbackIssue(config, issue);

    expect(result).toEqual({ ok: false, reason: 'unknown' });
  });

  describe('after a rejected create', () => {
    const duplicateId = () =>
      Promise.resolve(
        jsonResponse({ errors: [{ message: 'id already exists' }] }),
      );

    it.each([
      [
        'a 401 lookup',
        () => jsonResponse({ errors: [{ message: 'Authentication' }] }, 401),
      ],
      [
        'a 429 lookup',
        () => jsonResponse({ errors: [{ message: 'Ratelimited' }] }, 429),
      ],
      [
        'a lookup denied by permissions',
        () => jsonResponse({ errors: [{ message: 'Forbidden' }], data: null }),
      ],
      [
        'a lookup with incomplete issue fields',
        () => jsonResponse({ data: { issue: { identifier: 'AIT-0' } } }),
      ],
      ['a lookup with no data', () => jsonResponse({})],
    ])('stays unknown on %s', async (_label, respondLookup) => {
      fetchMock
        .mockImplementationOnce(duplicateId)
        .mockImplementationOnce(async () => respondLookup());

      const result = await createFeedbackIssue(config, issue);

      expect(result).toEqual({ ok: false, reason: 'unknown' });
    });

    it('is an error when the lookup returns a null issue', async () => {
      fetchMock
        .mockImplementationOnce(duplicateId)
        .mockResolvedValueOnce(jsonResponse({ data: { issue: null } }));

      const result = await createFeedbackIssue(config, issue);

      expect(result).toEqual({ ok: false, reason: 'error' });
    });
  });

  it('is an error when the key is refused, whatever the lookup says', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ errors: [{ message: 'Authentication' }] }, 401),
      )
      .mockRejectedValueOnce(new Error('socket hang up'));

    const result = await createFeedbackIssue(config, issue);

    expect(result).toEqual({ ok: false, reason: 'error' });
  });

  it('returns the existing issue when the same report was already filed', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          errors: [{ message: 'id already exists' }],
          data: null,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(existing));

    const result = await createFeedbackIssue(config, issue);

    expect(result).toEqual({
      ok: true,
      identifier: 'AIT-0',
      url: 'https://linear.app/84000/AIT-0',
      duplicate: true,
    });
    const lookup = JSON.parse(fetchMock.mock.calls[1][1]?.body as string);
    expect(lookup.query).toContain('issue(id: $id)');
    expect(lookup.variables).toEqual({
      id: await feedbackIssueId('bug', 'T', 'D'),
    });
  });

  it('finds an issue whose create timed out after it was applied', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(jsonResponse(existing));

    const result = await createFeedbackIssue(config, issue);

    expect(result).toMatchObject({ ok: true, duplicate: true });
  });

  it('sends a timeout signal with the request', async () => {
    fetchMock.mockResolvedValue(jsonResponse(created));

    await createFeedbackIssue(config, issue);

    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('feedbackIssueId', () => {
  const uuidV4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('is a stable UUID v4 for the same report', async () => {
    const a = await feedbackIssueId('bug', 'T', 'D');

    expect(a).toMatch(uuidV4);
    expect(await feedbackIssueId('bug', 'T', 'D')).toBe(a);
  });

  it('differs when any part of the report differs', async () => {
    const a = await feedbackIssueId('bug', 'T', 'D');

    expect(await feedbackIssueId('feedback', 'T', 'D')).not.toBe(a);
    expect(await feedbackIssueId('bug', 'T2', 'D')).not.toBe(a);
    expect(await feedbackIssueId('bug', 'T', 'D2')).not.toBe(a);
  });
});
