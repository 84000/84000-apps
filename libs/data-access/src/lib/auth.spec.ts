import { checkPermission, hasPermission } from './auth';
import type { DataClient } from './types';

const clientAnswering = (data: unknown, error: { message: string } | null) =>
  ({
    rpc: jest.fn(async () => ({ data, error })),
  }) as unknown as DataClient;

describe('permission checks', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes on the database answer', async () => {
    const client = clientAnswering(true, null);
    await expect(
      checkPermission({ client, permission: 'editor.read' }),
    ).resolves.toBe(true);
    expect(client.rpc).toHaveBeenCalledWith('authorize', {
      requested_permission: 'editor.read',
    });

    await expect(
      checkPermission({
        client: clientAnswering(false, null),
        permission: 'editor.read',
      }),
    ).resolves.toBe(false);
  });

  it('tells a failed check from a refusal', async () => {
    const client = clientAnswering(null, { message: 'JWTIssuedAtFuture' });
    await expect(
      checkPermission({ client, permission: 'editor.read' }),
    ).resolves.toBeNull();
    await expect(
      hasPermission({ client, permission: 'editor.read' }),
    ).resolves.toBe(false);
  });
});
