import { getCommentAuthorProfiles } from './authors';

type FakeState = {
  rows: Record<string, unknown>[];
  rpcCalls: [string, unknown][];
  error?: { message: string };
};

const createFakeClient = (state: FakeState) =>
  ({
    rpc: (name: string, args: unknown) => {
      state.rpcCalls.push([name, args]);
      return Promise.resolve(
        state.error
          ? { data: null, error: state.error }
          : { data: state.rows, error: null },
      );
    },
  }) as never;

const createState = (rows: Record<string, unknown>[] = []): FakeState => ({
  rows,
  rpcCalls: [],
});

describe('getCommentAuthorProfiles', () => {
  it('reads through the definer function, not user_profiles', async () => {
    const state = createState([{ id: 'u-1', full_name: 'Dorje' }]);

    await getCommentAuthorProfiles({
      client: createFakeClient(state),
      ids: ['u-1'],
    });

    expect(state.rpcCalls).toEqual([
      ['comment_author_profiles', { p_ids: ['u-1'] }],
    ]);
  });

  it('prefers full name, falls back to username, then to a generic label', async () => {
    const state = createState([
      { id: 'u-1', full_name: 'Dorje', username: 'dorje' },
      { id: 'u-2', full_name: null, username: 'pema' },
      { id: 'u-3', full_name: null, username: null },
    ]);

    const result = await getCommentAuthorProfiles({
      client: createFakeClient(state),
      ids: ['u-1', 'u-2', 'u-3'],
    });

    expect(result.get('u-1')?.displayName).toBe('Dorje');
    expect(result.get('u-2')?.displayName).toBe('pema');
    expect(result.get('u-3')?.displayName).toBe('Unknown author');
  });

  it('omits an absent avatar rather than carrying null', async () => {
    const state = createState([
      { id: 'u-1', full_name: 'Dorje', avatar_url: 'https://example/a.png' },
      { id: 'u-2', full_name: 'Pema', avatar_url: null },
    ]);

    const result = await getCommentAuthorProfiles({
      client: createFakeClient(state),
      ids: ['u-1', 'u-2'],
    });

    expect(result.get('u-1')?.avatarUrl).toBe('https://example/a.png');
    expect(result.get('u-2')).not.toHaveProperty('avatarUrl');
  });

  it('never exposes an email address', async () => {
    const state = createState([
      { id: 'u-1', full_name: 'Dorje', email: 'dorje@example.org' },
    ]);

    const result = await getCommentAuthorProfiles({
      client: createFakeClient(state),
      ids: ['u-1'],
    });

    expect(result.get('u-1')).toEqual({ id: 'u-1', displayName: 'Dorje' });
  });

  it('dedupes ids, so a thread of many replies by one person reads one profile', async () => {
    const state = createState([{ id: 'u-1', full_name: 'Dorje' }]);

    await getCommentAuthorProfiles({
      client: createFakeClient(state),
      ids: ['u-1', 'u-1', 'u-1'],
    });

    expect(state.rpcCalls).toEqual([
      ['comment_author_profiles', { p_ids: ['u-1'] }],
    ]);
  });

  it('does not call for an empty id list', async () => {
    const state = createState();

    const result = await getCommentAuthorProfiles({
      client: createFakeClient(state),
      ids: [],
    });

    expect(result.size).toBe(0);
    expect(state.rpcCalls).toEqual([]);
  });

  it('returns empty when the function denies permission', async () => {
    const state = createState();
    state.error = { message: 'Permission denied: editor.read required' };
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const result = await getCommentAuthorProfiles({
      client: createFakeClient(state),
      ids: ['u-1'],
    });

    expect(result.size).toBe(0);
    consoleError.mockRestore();
  });
});
