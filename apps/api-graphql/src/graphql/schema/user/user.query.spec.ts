import { userQueries } from './user.query';
import type { GraphQLContext } from '../../context';

jest.mock('@eightyfourthousand/data-access', () => ({
  checkPermission: jest.fn(),
}));

const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  checkPermission: jest.Mock;
};

const signedIn = {
  supabase: {},
  session: { userId: 'u1', email: 'a@b.c', claims: { role: 'admin' } },
} as unknown as GraphQLContext;

const ask = (ctx: GraphQLContext, permission = 'EDITOR_READ') =>
  userQueries.hasPermission(undefined, { permission }, ctx);

describe('userQueries.hasPermission', () => {
  beforeEach(() => {
    dataAccess.checkPermission.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes on the database answer', async () => {
    dataAccess.checkPermission.mockResolvedValue(true);
    await expect(ask(signedIn)).resolves.toBe(true);
    expect(dataAccess.checkPermission).toHaveBeenCalledWith({
      client: signedIn.supabase,
      permission: 'editor.read',
    });

    dataAccess.checkPermission.mockResolvedValue(false);
    await expect(ask(signedIn)).resolves.toBe(false);
  });

  it('throws when the check itself fails', async () => {
    dataAccess.checkPermission.mockResolvedValue(null);
    await expect(ask(signedIn)).rejects.toThrow('Permission check failed');
  });

  it('denies without asking when signed out or the permission is unknown', async () => {
    const signedOut = { ...signedIn, session: null } as GraphQLContext;
    await expect(ask(signedOut)).resolves.toBe(false);
    await expect(ask(signedIn, 'NOT_A_PERMISSION')).resolves.toBe(false);
    expect(dataAccess.checkPermission).not.toHaveBeenCalled();
  });
});
