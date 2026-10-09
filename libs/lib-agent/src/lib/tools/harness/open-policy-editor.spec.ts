import type {
  DataClient,
  UserPermission,
} from '@eightyfourthousand/data-access';
import {
  hasPermission,
  isValidPolicyName,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import {
  createHarnessTools,
  createOpenPolicyEditorTool,
  createPolicyEditorResource,
  MCP_APP_MIME_TYPE,
  POLICY_EDITOR_RESOURCE_URI,
  POLICY_TOOL_NAMES,
} from './index';

jest.mock('@eightyfourthousand/data-access', () => ({
  hasPermission: jest.fn(),
  isValidPolicyName: jest.fn(),
  policyName: jest.requireActual('@eightyfourthousand/data-access').policyName,
}));

const mockedHasPermission = jest.mocked(hasPermission);
const mockedIsValidName = jest.mocked(isValidPolicyName);

const client = {} as DataClient;
type Result = Awaited<ReturnType<McpToolDefinition['handler']>>;
const extra = {} as Parameters<McpToolDefinition['handler']>[1];
const call = (args: Record<string, unknown>) =>
  createOpenPolicyEditorTool(client).handler(args, extra) as Promise<Result>;
const parse = (result: Result) =>
  JSON.parse((result.content[0] as { text: string }).text);

const grant = (...held: UserPermission[]) =>
  mockedHasPermission.mockImplementation(async ({ permission }) =>
    held.includes(permission),
  );

beforeEach(() => {
  jest.clearAllMocks();
  grant('harness.read');
  mockedIsValidName.mockReturnValue(true);
});

describe('open-policy-editor', () => {
  it('refuses without harness.read', async () => {
    grant();

    const result = await call({ name: 'a/b' });

    expect(mockedHasPermission).toHaveBeenCalledTimes(1);
    expect(mockedHasPermission).toHaveBeenCalledWith({
      client,
      permission: 'harness.read',
    });
    expect(result.isError).toBe(true);
    expect(parse(result)).toMatchObject({ ok: false, reason: 'forbidden' });
  });

  it.each([
    ['a reader', ['harness.read'], { read: true, edit: false, admin: false }],
    [
      'a translator',
      ['harness.read', 'harness.edit'],
      { read: true, edit: true, admin: false },
    ],
    [
      'an admin',
      ['harness.read', 'harness.edit', 'harness.admin'],
      { read: true, edit: true, admin: true },
    ],
  ] as const)('returns the permissions of %s', async (_, held, permissions) => {
    grant(...held);

    const result = await call({});
    const body = parse(result);

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toBeUndefined();
    expect(body.permissions).toEqual(permissions);
    expect(body.message.includes('read-only')).toBe(!permissions.edit);
  });

  it('opens on a named policy', async () => {
    const body = parse(await call({ name: 'shared-policies/terminology' }));

    expect(mockedIsValidName).toHaveBeenCalledWith(
      'shared-policies/terminology',
    );
    expect(body).toEqual({
      name: 'shared-policies/terminology',
      permissions: { read: true, edit: false, admin: false },
      message: expect.stringContaining('on `shared-policies/terminology`'),
    });
  });

  it('drops a trailing .md from the name it echoes', async () => {
    const body = parse(await call({ name: 'shared-policies/terminology.md' }));

    expect(body.name).toBe('shared-policies/terminology');
    expect(body.message).toContain('on `shared-policies/terminology`.');
    expect(body.message).not.toContain('terminology.md');
  });

  it('opens on the list without a name', async () => {
    const body = parse(await call({}));

    expect(body).not.toHaveProperty('name');
    expect(body.message).toContain('on the list of policies');
    expect(body.message).toContain('Claude Code in a terminal');
    expect(mockedIsValidName).not.toHaveBeenCalled();
  });

  it('falls back to the list on an invalid name, and says so', async () => {
    mockedIsValidName.mockReturnValue(false);

    const body = parse(await call({ name: 'archive/x' }));

    expect(body).not.toHaveProperty('name');
    expect(body.message).toContain('on the list of policies');
    expect(body.message).toContain('`archive/x` is not a valid policy name');
  });

  it('links the editor resource for the model and the app', () => {
    const tool = createOpenPolicyEditorTool(client);

    expect(tool.name).toBe(POLICY_TOOL_NAMES.openEditor);
    expect(tool._meta).toEqual({
      ui: {
        resourceUri: POLICY_EDITOR_RESOURCE_URI,
        visibility: ['model', 'app'],
      },
      'ui/resourceUri': POLICY_EDITOR_RESOURCE_URI,
    });
    expect(tool.annotations).toMatchObject({
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it('is not one of the harness tools', () => {
    const names = createHarnessTools(client).map((t) => t.name);

    expect(names).not.toContain(POLICY_TOOL_NAMES.openEditor);
  });
});

describe('createPolicyEditorResource', () => {
  it('serves the html as the MCP App resource, with no domain or CSP', () => {
    const resource = createPolicyEditorResource('<html></html>');

    expect(resource).toMatchObject({
      uri: POLICY_EDITOR_RESOURCE_URI,
      mimeType: 'text/html;profile=mcp-app',
      text: '<html></html>',
    });
    expect(resource._meta).toEqual({ ui: { prefersBorder: true } });
    expect(MCP_APP_MIME_TYPE).toBe('text/html;profile=mcp-app');
  });
});
