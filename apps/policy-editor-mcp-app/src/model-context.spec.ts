import {
  describePolicyChange,
  type PolicyChange,
  reportPolicyChange,
  tellClaude,
} from './model-context';

const saved: PolicyChange = { kind: 'saved', name: 'a/b', version: 'v2' };

describe('describePolicyChange', () => {
  it.each<[PolicyChange, string]>([
    [
      saved,
      'Policy editor: "a/b" was saved (new version v2). Re-read "a/b" with read-policies before relying on it.',
    ],
    [
      { kind: 'created', name: 'a/c', version: 'v1' },
      'Policy editor: "a/c" was created (version v1). Re-read "a/c" with read-policies before relying on it.',
    ],
    [
      {
        kind: 'restored',
        name: 'a/b',
        version: 'v3',
        revisionPath: 'archive/a/b.md/1.md',
      },
      'Policy editor: "a/b" was restored from archive/a/b.md/1.md (new version v3). Re-read "a/b" with read-policies before relying on it.',
    ],
    [
      { kind: 'deleted', name: 'a/b', archivedPath: 'archive/a/b.md/2.md' },
      'Policy editor: "a/b" was deleted; its last text is archived at archive/a/b.md/2.md. Do not rely on an earlier read of it.',
    ],
    [
      {
        kind: 'renamed',
        from: 'a/b',
        to: 'a/c',
        archivedPath: 'archive/a/b.md/3.md',
      },
      'Policy editor: "a/b" was renamed to "a/c"; the old text is archived at archive/a/b.md/3.md. Re-read "a/c" with read-policies before relying on it.',
    ],
  ])('describes %o', (change, text) => {
    expect(describePolicyChange(change)).toBe(text);
  });
});

describe('reportPolicyChange', () => {
  it('sends the description as model context', async () => {
    const app = { updateModelContext: jest.fn(async () => ({})) };
    await expect(reportPolicyChange(app, saved)).resolves.toBe(true);
    expect(app.updateModelContext).toHaveBeenCalledWith({
      content: [{ type: 'text', text: describePolicyChange(saved) }],
    });
  });

  it('swallows a host that refuses it', async () => {
    const app = {
      updateModelContext: jest.fn(async () => {
        throw new Error('Method not found');
      }),
    };
    await expect(reportPolicyChange(app, saved)).resolves.toBe(false);
  });
});

describe('tellClaude', () => {
  it('posts the description as a user message', async () => {
    const app = { sendMessage: jest.fn(async () => ({})) };
    await expect(tellClaude(app, saved)).resolves.toBe(true);
    expect(app.sendMessage).toHaveBeenCalledWith({
      role: 'user',
      content: [{ type: 'text', text: describePolicyChange(saved) }],
    });
  });

  it('reports a refused or failed message', async () => {
    const refused = { sendMessage: jest.fn(async () => ({ isError: true })) };
    const failed = {
      sendMessage: jest.fn(async (): Promise<{ isError?: boolean }> => {
        throw new Error('closed');
      }),
    };
    await expect(tellClaude(refused, saved)).resolves.toBe(false);
    await expect(tellClaude(failed, saved)).resolves.toBe(false);
  });
});
