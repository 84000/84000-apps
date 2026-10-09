import { createOpenState, parseOpenState } from './open-state';

const json = (body: unknown, extra: Record<string, unknown> = {}) => ({
  content: [{ type: 'text', text: JSON.stringify(body) }],
  ...extra,
});

const all = { read: true, edit: true, admin: true };
const none = { read: false, edit: false, admin: false };
const readOnly = { read: true, edit: false, admin: false };

const fakeCaller = (response?: unknown) => ({
  callServerTool: jest.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  }),
});

describe('parseOpenState', () => {
  it('reads the name and permissions from the content text', () => {
    expect(
      parseOpenState(
        json({ name: 'a/b', permissions: readOnly, message: 'Opened' }),
      ),
    ).toEqual({ name: 'a/b', permissions: readOnly });
  });

  it('ignores structuredContent', () => {
    expect(
      parseOpenState(
        json(
          { permissions: readOnly },
          { structuredContent: { name: 'x/y', permissions: all } },
        ),
      ),
    ).toEqual({ permissions: readOnly });
  });

  it.each([
    ['missing', {}],
    ['not an object', { permissions: 'all' }],
    ['a non-boolean flag', { permissions: { ...all, edit: 'yes' } }],
    ['a missing flag', { permissions: { read: true, edit: true } }],
  ])('fails closed when permissions are %s', (_case, body) => {
    expect(parseOpenState(json(body))?.permissions).toEqual(none);
  });

  it('returns undefined for an error or unparseable result', () => {
    expect(
      parseOpenState(
        json({ ok: false, reason: 'forbidden' }, { isError: true }),
      ),
    ).toBeUndefined();
    expect(
      parseOpenState({ content: [{ type: 'text', text: 'nope' }] }),
    ).toBeUndefined();
    expect(parseOpenState(undefined)).toBeUndefined();
  });
});

describe('createOpenState', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('uses a result delivered before resolve', async () => {
    const caller = fakeCaller();
    const open = createOpenState(caller);
    open.toolResult(json({ name: 'a/b', permissions: all }));
    await expect(open.resolve()).resolves.toEqual({
      name: 'a/b',
      permissions: all,
    });
    expect(caller.callServerTool).not.toHaveBeenCalled();
  });

  it('uses a result delivered while waiting', async () => {
    const caller = fakeCaller();
    const open = createOpenState(caller);
    const state = open.resolve();
    open.toolResult(json({ permissions: readOnly }));
    await expect(state).resolves.toEqual({ permissions: readOnly });
    jest.runAllTimers();
    expect(caller.callServerTool).not.toHaveBeenCalled();
  });

  it('trusts a result without a name over the tool input name', async () => {
    const open = createOpenState(fakeCaller());
    open.toolInput({ name: 'not a policy' });
    open.toolResult(json({ permissions: readOnly }));
    await expect(open.resolve()).resolves.toEqual({ permissions: readOnly });
  });

  it('shares one resolution between concurrent calls', async () => {
    const caller = fakeCaller(json({ permissions: readOnly }));
    const open = createOpenState(caller, { timeoutMs: 10 });
    const first = open.resolve();
    const second = open.resolve();
    await jest.advanceTimersByTimeAsync(10);
    await expect(first).resolves.toEqual({ permissions: readOnly });
    await expect(second).resolves.toEqual({ permissions: readOnly });
    expect(caller.callServerTool).toHaveBeenCalledTimes(1);
  });

  it('calls open-policy-editor with the input name after the timeout', async () => {
    const caller = fakeCaller(json({ name: 'a/b', permissions: readOnly }));
    const open = createOpenState(caller, { timeoutMs: 500 });
    open.toolInput({ name: 'a/b' });
    open.toolResult({ content: [{ type: 'text', text: 'not json' }] });
    const state = open.resolve();
    await jest.advanceTimersByTimeAsync(500);
    await expect(state).resolves.toEqual({
      name: 'a/b',
      permissions: readOnly,
    });
    expect(caller.callServerTool).toHaveBeenCalledWith({
      name: 'open-policy-editor',
      arguments: { name: 'a/b' },
    });
  });

  it('calls open-policy-editor without a name when there was no input', async () => {
    const caller = fakeCaller(json({ permissions: all }));
    const open = createOpenState(caller);
    const state = open.resolve();
    await jest.advanceTimersByTimeAsync(3000);
    await expect(state).resolves.toEqual({ permissions: all });
    expect(caller.callServerTool).toHaveBeenCalledWith({
      name: 'open-policy-editor',
      arguments: {},
    });
  });

  it('retries through the fallback after an error result', async () => {
    const caller = fakeCaller(json({ permissions: readOnly }));
    const open = createOpenState(caller, { timeoutMs: 10 });
    open.toolResult(
      json({ ok: false, reason: 'error', message: 'flaky' }, { isError: true }),
    );
    const state = open.resolve();
    await jest.advanceTimersByTimeAsync(10);
    await expect(state).resolves.toEqual({ permissions: readOnly });
  });

  it.each([
    ['the call throws', new Error('bridge closed')],
    [
      'the result is an error',
      json({ ok: false, reason: 'forbidden' }, { isError: true }),
    ],
    ['the result is unparseable', { content: [] }],
  ])('fails closed when %s', async (_case, response) => {
    const open = createOpenState(fakeCaller(response), { timeoutMs: 10 });
    open.toolInput({ name: 'a/b' });
    const state = open.resolve();
    await jest.advanceTimersByTimeAsync(10);
    await expect(state).resolves.toEqual({ name: 'a/b', permissions: none });
  });
});
