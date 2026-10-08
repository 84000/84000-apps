import type { DataClient } from '@eightyfourthousand/data-access';
import {
  deletePolicy,
  hasPermission,
  isValidPolicyName,
  listPolicyRevisions,
  readPolicyRevision,
  renamePolicy,
  restorePolicy,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import {
  createDeletePolicyTool,
  createHarnessTools,
  createPolicyHistoryTool,
  createReadPolicyRevisionTool,
  createRenamePolicyTool,
  createRestorePolicyTool,
  POLICY_EDITOR_RESOURCE_URI,
  POLICY_TOOL_NAMES,
} from './index';

jest.mock('@eightyfourthousand/data-access', () => ({
  hasPermission: jest.fn(),
  isValidPolicyName: jest.fn(),
  listPolicies: jest.fn(),
  readPolicies: jest.fn(),
  writePolicy: jest.fn(),
  listPolicyRevisions: jest.fn(),
  readPolicyRevision: jest.fn(),
  restorePolicy: jest.fn(),
  deletePolicy: jest.fn(),
  renamePolicy: jest.fn(),
}));

const mockedHasPermission = jest.mocked(hasPermission);
const mockedIsValidName = jest.mocked(isValidPolicyName);
const mockedHistory = jest.mocked(listPolicyRevisions);
const mockedReadRevision = jest.mocked(readPolicyRevision);
const mockedRestore = jest.mocked(restorePolicy);
const mockedDelete = jest.mocked(deletePolicy);
const mockedRename = jest.mocked(renamePolicy);

const client = {} as DataClient;
type Result = Awaited<ReturnType<McpToolDefinition['handler']>>;
const extra = {} as Parameters<McpToolDefinition['handler']>[1];
const call = (tool: McpToolDefinition, args: Record<string, unknown>) =>
  tool.handler(args, extra) as Promise<Result>;
const parse = (result: Result) =>
  JSON.parse((result.content[0] as { text: string }).text);

const revisionPath = 'archive/a/b.md/20260908T193000Z.md';
const revision = {
  name: 'a/b',
  path: revisionPath,
  archivedAt: '2026-09-08T19:30:00.000Z',
};
const current = { name: 'a/b', content: '## B. Names', version: 'v3' };

beforeEach(() => {
  jest.clearAllMocks();
  mockedHasPermission.mockResolvedValue(true);
  mockedIsValidName.mockReturnValue(true);
});

describe('policy editor tools', () => {
  it.each([
    [createPolicyHistoryTool, { name: 'a/b' }, 'harness.read', mockedHistory],
    [
      createReadPolicyRevisionTool,
      { path: revisionPath },
      'harness.read',
      mockedReadRevision,
    ],
    [
      createRestorePolicyTool,
      { name: 'a/b', revisionPath },
      'harness.edit',
      mockedRestore,
    ],
    [createDeletePolicyTool, { name: 'a/b' }, 'harness.admin', mockedDelete],
    [
      createRenamePolicyTool,
      { from: 'a/b', to: 'a/c' },
      'harness.admin',
      mockedRename,
    ],
  ] as const)(
    '%o refuses without %s and touches no data',
    async (create, args, permission, dataCall) => {
      mockedHasPermission.mockResolvedValue(false);

      const result = await call(create(client), args);

      expect(mockedHasPermission).toHaveBeenCalledWith({ client, permission });
      expect(result.isError).toBe(true);
      expect(parse(result)).toMatchObject({ ok: false, reason: 'forbidden' });
      expect(dataCall).not.toHaveBeenCalled();
    },
  );

  it('marks exactly the five editor tools app-only', () => {
    const tools = createHarnessTools(client);
    const appOnly = tools.filter((tool) => tool._meta).map((t) => t.name);

    expect(appOnly).toEqual([
      POLICY_TOOL_NAMES.history,
      POLICY_TOOL_NAMES.readRevision,
      POLICY_TOOL_NAMES.restore,
      POLICY_TOOL_NAMES.delete,
      POLICY_TOOL_NAMES.rename,
    ]);
    for (const tool of tools.filter((t) => t._meta)) {
      expect(tool._meta).toEqual({
        ui: { resourceUri: POLICY_EDITOR_RESOURCE_URI, visibility: ['app'] },
      });
    }
    expect(POLICY_EDITOR_RESOURCE_URI).toBe('ui://policy-editor/app.html');
  });

  it('shares one frozen _meta across the editor tools', () => {
    const meta = createPolicyHistoryTool(client)._meta as {
      ui: { visibility: string[] };
    };

    expect(Object.isFrozen(meta)).toBe(true);
    expect(Object.isFrozen(meta.ui)).toBe(true);
    expect(Object.isFrozen(meta.ui.visibility)).toBe(true);
  });

  it('tells the model the editor tools are not for chat', () => {
    const tools = createHarnessTools(client);
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    const appOnly =
      'Called only by the policy editor app; do not call it from chat.';
    const openEditor = `the user opens the editor with ${POLICY_TOOL_NAMES.openEditor}.`;

    for (const tool of tools.filter((t) => t._meta)) {
      expect(tool.description).toContain(appOnly);
    }
    for (const tool of tools.filter((t) => !t._meta)) {
      expect(tool.description).not.toContain(appOnly);
    }
    for (const name of [POLICY_TOOL_NAMES.delete, POLICY_TOOL_NAMES.rename]) {
      expect(byName[name].description).toMatch(new RegExp(`${openEditor}$`));
    }
    expect(POLICY_TOOL_NAMES.openEditor).toBe('open-policy-editor');
  });
});

describe('policy-history', () => {
  const tool = createPolicyHistoryTool(client);

  it('returns the revisions newest first as listed', async () => {
    mockedHistory.mockResolvedValue([revision]);

    const result = await call(tool, { name: 'a/b' });

    expect(mockedHistory).toHaveBeenCalledWith({ client, name: 'a/b' });
    expect(parse(result)).toEqual({ revisions: [revision] });
  });

  it('reports a failed listing as an error, not an empty history', async () => {
    mockedHistory.mockResolvedValue(undefined);

    const result = await call(tool, { name: 'a/b' });

    expect(result.isError).toBe(true);
    expect(parse(result)).toMatchObject({
      ok: false,
      reason: 'error',
      message: 'Could not list the revisions of a/b.',
    });
  });

  it('says an invalid name is invalid rather than a failed listing', async () => {
    mockedHistory.mockResolvedValue(undefined);
    mockedIsValidName.mockReturnValue(false);

    const result = await call(tool, { name: 'archive/a' });

    expect(mockedIsValidName).toHaveBeenCalledWith('archive/a');
    expect(result.isError).toBe(true);
    const body = parse(result);
    expect(body).toMatchObject({ ok: false, reason: 'error' });
    expect(body.message).toContain('archive/a is not a valid policy name');
  });
});

describe('read-policy-revision', () => {
  const tool = createReadPolicyRevisionTool(client);

  it('returns the revision and its content', async () => {
    mockedReadRevision.mockResolvedValue({
      ok: true,
      revision,
      content: '## Old',
    });

    const result = await call(tool, { path: revisionPath });

    expect(result.isError).toBeUndefined();
    // Exactly the fields the tool has always returned; `ok` stays internal.
    expect(parse(result)).toEqual({ revision, content: '## Old' });
  });

  it('reports a revision that is not there as not-found', async () => {
    mockedReadRevision.mockResolvedValue({ ok: false, reason: 'not-found' });

    const result = await call(tool, { path: 'policies/a/b.md' });

    expect(result.isError).toBe(true);
    expect(parse(result)).toEqual({ ok: false, reason: 'not-found' });
  });

  it('reports a storage failure as an error, not as not-found', async () => {
    mockedReadRevision.mockResolvedValue({
      ok: false,
      reason: 'error',
      message: `Could not read the revision ${revisionPath} (Internal error).`,
    });

    const result = await call(tool, { path: revisionPath });

    expect(result.isError).toBe(true);
    expect(parse(result)).toEqual({
      ok: false,
      reason: 'error',
      message: `Could not read the revision ${revisionPath} (Internal error).`,
    });
  });
});

describe('restore-policy', () => {
  const tool = createRestorePolicyTool(client);

  it('forwards expectedVersion and returns the write result', async () => {
    const written = {
      ok: true as const,
      version: 'v4',
      created: false,
      archivedPath: 'archive/a/b.md/20261005T120000Z.md',
    };
    mockedRestore.mockResolvedValue(written);

    const result = await call(tool, {
      name: 'a/b',
      revisionPath,
      expectedVersion: 'v3',
    });

    expect(mockedRestore).toHaveBeenCalledWith({
      client,
      name: 'a/b',
      revisionPath,
      expectedVersion: 'v3',
    });
    expect(parse(result)).toEqual(written);
  });

  it('passes a conflict through with the live document', async () => {
    mockedRestore.mockResolvedValue({ ok: false, reason: 'conflict', current });

    const result = await call(tool, {
      name: 'a/b',
      revisionPath,
      expectedVersion: 'v1',
    });

    expect(result.isError).toBe(true);
    expect(parse(result)).toEqual({ ok: false, reason: 'conflict', current });
  });

  it('keeps a failed revision read apart from a missing revision', async () => {
    mockedRestore.mockResolvedValueOnce({ ok: false, reason: 'not-found' });
    mockedRestore.mockResolvedValueOnce({
      ok: false,
      reason: 'error',
      message: 'Could not read the revision (Internal error).',
    });

    const gone = await call(tool, { name: 'a/b', revisionPath });
    const failed = await call(tool, { name: 'a/b', revisionPath });

    expect(parse(gone)).toEqual({ ok: false, reason: 'not-found' });
    expect(parse(failed)).toEqual({
      ok: false,
      reason: 'error',
      message: 'Could not read the revision (Internal error).',
    });
  });
});

describe('delete-policy', () => {
  const tool = createDeletePolicyTool(client);

  it('returns where the deleted text was archived', async () => {
    mockedDelete.mockResolvedValue({ ok: true, archivedPath: revisionPath });

    const result = await call(tool, { name: 'a/b', expectedVersion: 'v3' });

    expect(mockedDelete).toHaveBeenCalledWith({
      client,
      name: 'a/b',
      expectedVersion: 'v3',
    });
    expect(parse(result)).toEqual({ ok: true, archivedPath: revisionPath });
  });

  it('reports a missing policy as not-found', async () => {
    mockedDelete.mockResolvedValue({ ok: false, reason: 'not-found' });

    const result = await call(tool, { name: 'a/gone' });

    expect(result.isError).toBe(true);
    expect(parse(result)).toEqual({ ok: false, reason: 'not-found' });
  });

  it('passes a conflict through with the live document', async () => {
    mockedDelete.mockResolvedValue({ ok: false, reason: 'conflict', current });

    const result = await call(tool, { name: 'a/b', expectedVersion: 'v1' });

    expect(parse(result)).toEqual({ ok: false, reason: 'conflict', current });
  });
});

describe('rename-policy', () => {
  const tool = createRenamePolicyTool(client);

  it('returns where the old name was archived', async () => {
    mockedRename.mockResolvedValue({ ok: true, archivedPath: revisionPath });

    const result = await call(tool, {
      from: 'a/b',
      to: 'a/c',
      expectedVersion: 'v3',
    });

    expect(mockedRename).toHaveBeenCalledWith({
      client,
      from: 'a/b',
      to: 'a/c',
      expectedVersion: 'v3',
    });
    expect(parse(result)).toEqual({ ok: true, archivedPath: revisionPath });
  });

  it('reports a taken target as exists', async () => {
    mockedRename.mockResolvedValue({ ok: false, reason: 'exists' });

    const result = await call(tool, { from: 'a/b', to: 'a/c' });

    expect(result.isError).toBe(true);
    expect(parse(result)).toEqual({ ok: false, reason: 'exists' });
  });
});
