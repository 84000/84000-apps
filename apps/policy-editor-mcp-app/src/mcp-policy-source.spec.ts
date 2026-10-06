import { createMcpPolicySource, PolicySourceError } from './mcp-policy-source';
import type { PolicySource } from './policy-source.contract';
import type { ToolCaller } from './tool-result';

/** A tool result as lib-agent's `jsonResult` builds it. */
const json = (body: unknown, extra: Record<string, unknown> = {}) => ({
  content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
  ...extra,
});
/** A failure as lib-agent's `policyFailureResult` builds it. */
const failure = (body: Record<string, unknown>) =>
  json(body, { isError: true });

const doc = { name: 'a/b', content: '# B', version: 'v1' };
const revision = {
  name: 'a/b',
  path: 'archive/a/b.md/20260908T193000Z.md',
  archivedAt: '2026-09-08T19:30:00.000Z',
};

/** A caller that answers each call with the next response, or throws it. */
const fakeCaller = (...responses: unknown[]) => {
  const callServerTool = jest.fn<
    ReturnType<ToolCaller['callServerTool']>,
    Parameters<ToolCaller['callServerTool']>
  >(async () => {
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  return { callServerTool };
};

const setup = (...responses: unknown[]) => {
  const caller = fakeCaller(...responses);
  return { caller, source: createMcpPolicySource(caller) };
};

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as PolicySourceError;
  }
  throw new Error('expected a rejection');
};

describe('createMcpPolicySource', () => {
  describe('list', () => {
    it('calls read-policies with no names and returns the names', async () => {
      const { caller, source } = setup(json({ policies: ['a/b', 'c/d'] }));
      await expect(source.list()).resolves.toEqual(['a/b', 'c/d']);
      expect(caller.callServerTool).toHaveBeenCalledWith({
        name: 'read-policies',
        arguments: {},
      });
    });

    it('reads content and ignores structuredContent', async () => {
      const { source } = setup(
        json(
          { policies: ['a/b'] },
          { structuredContent: { policies: ['x/y'] } },
        ),
      );
      await expect(source.list()).resolves.toEqual(['a/b']);
    });

    it('does not fall back to structuredContent when content is missing', async () => {
      const { source } = setup({
        content: [],
        structuredContent: { policies: ['x/y'] },
      });
      await expect(source.list()).rejects.toThrow(
        'read-policies returned an unreadable result.',
      );
    });

    it('throws rather than returning an empty list on a server error', async () => {
      const { source } = setup(
        failure({
          ok: false,
          reason: 'error',
          message: 'Could not list the policies.',
        }),
      );
      const error = await rejection(source.list());
      expect(error).toBeInstanceOf(PolicySourceError);
      expect(error.message).toBe('Could not list the policies.');
    });

    it('throws a forbidden failure without the server message', async () => {
      const { source } = setup(
        failure({
          ok: false,
          reason: 'forbidden',
          message: 'needs harness.read',
        }),
      );
      const error = await rejection(source.list());
      expect(error.failure).toEqual({ ok: false, reason: 'forbidden' });
    });

    it('throws when the transport fails', async () => {
      const { source } = setup(new Error('bridge closed'));
      await expect(source.list()).rejects.toThrow(
        'Could not call read-policies: bridge closed',
      );
    });

    it('throws on an unparseable result', async () => {
      const { source } = setup({ content: [{ type: 'text', text: 'oops' }] });
      await expect(source.list()).rejects.toThrow(
        'read-policies returned an unreadable result: oops',
      );
    });

    it('throws on a result of the wrong shape', async () => {
      const { source } = setup(json({ policies: [1] }));
      await expect(source.list()).rejects.toThrow(
        'read-policies returned an unexpected result.',
      );
    });
  });

  describe('read', () => {
    it('calls read-policies with the one name and returns the document', async () => {
      const { caller, source } = setup(
        json({ policies: [{ ...doc, extra: true }] }),
      );
      await expect(source.read('a/b')).resolves.toEqual(doc);
      expect(caller.callServerTool).toHaveBeenCalledWith({
        name: 'read-policies',
        arguments: { names: ['a/b'] },
      });
    });

    it('returns undefined for not-found', async () => {
      const { source } = setup(
        failure({
          ok: false,
          reason: 'not-found',
          message: 'No policy matched a/b.',
        }),
      );
      await expect(source.read('a/b')).resolves.toBeUndefined();
    });

    it('returns undefined when the name comes back missing', async () => {
      const { source } = setup(json({ policies: [], missing: ['a/b'] }));
      await expect(source.read('a/b')).resolves.toBeUndefined();
    });

    it('throws, rather than reporting not-found, when the call fails', async () => {
      const { source } = setup(new Error('bridge closed'));
      await expect(source.read('a/b')).rejects.toThrow(PolicySourceError);
    });

    it('throws on a malformed document', async () => {
      const { source } = setup(json({ policies: [{ name: 'a/b' }] }));
      await expect(source.read('a/b')).rejects.toThrow('unexpected result');
    });
  });

  describe('write', () => {
    it('passes expectedVersion and strips the legacy fields', async () => {
      const { caller, source } = setup(
        json({
          ok: true,
          version: 'v2',
          created: false,
          archivedPath: revision.path,
          written: true,
          name: 'a/b',
        }),
      );
      await expect(
        source.write({ name: 'a/b', content: '# B2', expectedVersion: 'v1' }),
      ).resolves.toEqual({
        ok: true,
        version: 'v2',
        created: false,
        archivedPath: revision.path,
      });
      expect(caller.callServerTool).toHaveBeenCalledWith({
        name: 'write-policy',
        arguments: { name: 'a/b', content: '# B2', expectedVersion: 'v1' },
      });
    });

    it('omits expectedVersion when it is not given', async () => {
      const { caller, source } = setup(
        json({
          ok: true,
          version: 'v1',
          created: true,
          written: true,
          name: 'a/b',
        }),
      );
      await expect(
        source.write({ name: 'a/b', content: '# B' }),
      ).resolves.toEqual({ ok: true, version: 'v1', created: true });
      expect(caller.callServerTool).toHaveBeenCalledWith({
        name: 'write-policy',
        arguments: { name: 'a/b', content: '# B' },
      });
    });

    it('rejects a success without a version', async () => {
      const { source } = setup(json({ ok: true, created: true }));
      await expect(source.write({ name: 'a/b', content: '' })).resolves.toEqual(
        {
          ok: false,
          reason: 'error',
          message: 'write-policy returned an unexpected result.',
        },
      );
    });
  });

  describe('history', () => {
    it('returns the revisions in server order', async () => {
      const older = { ...revision, path: 'archive/a/b.md/20260901T000000Z.md' };
      const { caller, source } = setup(json({ revisions: [revision, older] }));
      await expect(source.history('a/b')).resolves.toEqual([revision, older]);
      expect(caller.callServerTool).toHaveBeenCalledWith({
        name: 'policy-history',
        arguments: { name: 'a/b' },
      });
    });

    it('throws rather than returning an empty history on failure', async () => {
      const { source } = setup(
        failure({
          ok: false,
          reason: 'error',
          message: 'Could not list the revisions of a/b.',
        }),
      );
      await expect(source.history('a/b')).rejects.toThrow(
        'Could not list the revisions of a/b.',
      );
    });

    it('throws on a malformed revision', async () => {
      const { source } = setup(json({ revisions: [{ path: 'x' }] }));
      await expect(source.history('a/b')).rejects.toThrow('unexpected result');
    });
  });

  describe('readRevision', () => {
    it('returns the revision and its content', async () => {
      const { caller, source } = setup(json({ revision, content: '# Old' }));
      await expect(source.readRevision(revision.path)).resolves.toEqual({
        revision,
        content: '# Old',
      });
      expect(caller.callServerTool).toHaveBeenCalledWith({
        name: 'read-policy-revision',
        arguments: { path: revision.path },
      });
    });

    it('returns undefined for not-found', async () => {
      const { source } = setup(failure({ ok: false, reason: 'not-found' }));
      await expect(source.readRevision(revision.path)).resolves.toBeUndefined();
    });

    it('throws when the transport fails', async () => {
      const { source } = setup(new Error('timeout'));
      await expect(source.readRevision(revision.path)).rejects.toThrow(
        'timeout',
      );
    });
  });

  describe('restore, delete and rename', () => {
    it('restore calls restore-policy and returns the write result', async () => {
      const { caller, source } = setup(
        json({ ok: true, version: 'v3', created: false, archivedPath: 'p' }),
      );
      await expect(
        source.restore({
          name: 'a/b',
          revisionPath: revision.path,
          expectedVersion: 'v2',
        }),
      ).resolves.toEqual({
        ok: true,
        version: 'v3',
        created: false,
        archivedPath: 'p',
      });
      expect(caller.callServerTool).toHaveBeenCalledWith({
        name: 'restore-policy',
        arguments: {
          name: 'a/b',
          revisionPath: revision.path,
          expectedVersion: 'v2',
        },
      });
    });

    it('delete calls delete-policy and returns the archive path', async () => {
      const { caller, source } = setup(json({ ok: true, archivedPath: 'p' }));
      await expect(
        source.delete({ name: 'a/b', expectedVersion: 'v1' }),
      ).resolves.toEqual({ ok: true, archivedPath: 'p' });
      expect(caller.callServerTool).toHaveBeenCalledWith({
        name: 'delete-policy',
        arguments: { name: 'a/b', expectedVersion: 'v1' },
      });
    });

    it('rename calls rename-policy and returns the archive path', async () => {
      const { caller, source } = setup(json({ ok: true, archivedPath: 'p' }));
      await expect(source.rename({ from: 'a/b', to: 'a/c' })).resolves.toEqual({
        ok: true,
        archivedPath: 'p',
      });
      expect(caller.callServerTool).toHaveBeenCalledWith({
        name: 'rename-policy',
        arguments: { from: 'a/b', to: 'a/c' },
      });
    });
  });

  // Every mutating method maps failures the same way.
  const mutations: Array<[string, (source: PolicySource) => Promise<unknown>]> =
    [
      [
        'write',
        (s) => s.write({ name: 'a/b', content: '', expectedVersion: 'v1' }),
      ],
      [
        'restore',
        (s) => s.restore({ name: 'a/b', revisionPath: revision.path }),
      ],
      ['delete', (s) => s.delete({ name: 'a/b' })],
      ['rename', (s) => s.rename({ from: 'a/b', to: 'a/c' })],
    ];

  describe.each(mutations)('%s failures', (_method, run) => {
    it('returns conflict with only the current document', async () => {
      const { source } = setup(
        failure({
          ok: false,
          reason: 'conflict',
          current: { ...doc, extra: 1 },
          message: 'a/b changed since it was read',
        }),
      );
      await expect(run(source)).resolves.toEqual({
        ok: false,
        reason: 'conflict',
        current: doc,
      });
    });

    it.each(['not-found', 'exists', 'forbidden'])(
      'returns %s without the server message',
      async (reason) => {
        const { source } = setup(
          failure({ ok: false, reason, message: 'explanation for the model' }),
        );
        await expect(run(source)).resolves.toEqual({ ok: false, reason });
      },
    );

    it('keeps the message of an error', async () => {
      const { source } = setup(
        failure({ ok: false, reason: 'error', message: 'archive failed' }),
      );
      await expect(run(source)).resolves.toEqual({
        ok: false,
        reason: 'error',
        message: 'archive failed',
      });
    });

    it('returns error when the transport fails', async () => {
      const { source } = setup(new Error('bridge closed'));
      await expect(run(source)).resolves.toMatchObject({
        ok: false,
        reason: 'error',
        message: expect.stringContaining('bridge closed'),
      });
    });

    it('returns error with the text of an unparseable result', async () => {
      const { source } = setup({
        content: [
          { type: 'text', text: 'MCP error -32602: invalid arguments' },
        ],
        isError: true,
      });
      await expect(run(source)).resolves.toMatchObject({
        ok: false,
        reason: 'error',
        message: expect.stringContaining('MCP error -32602: invalid arguments'),
      });
    });

    it('returns error for an unknown failure reason', async () => {
      const { source } = setup(failure({ ok: false, reason: 'gone' }));
      await expect(run(source)).resolves.toMatchObject({
        ok: false,
        reason: 'error',
      });
    });

    it('returns error for a conflict without a usable current document', async () => {
      const { source } = setup(
        failure({ ok: false, reason: 'conflict', current: { name: 'a/b' } }),
      );
      await expect(run(source)).resolves.toMatchObject({
        ok: false,
        reason: 'error',
      });
    });

    it('ignores a structuredContent success when content is a failure', async () => {
      const { source } = setup({
        ...failure({ ok: false, reason: 'forbidden' }),
        structuredContent: {
          ok: true,
          version: 'v9',
          created: false,
          archivedPath: 'p',
        },
      });
      await expect(run(source)).resolves.toEqual({
        ok: false,
        reason: 'forbidden',
      });
    });
  });
});
