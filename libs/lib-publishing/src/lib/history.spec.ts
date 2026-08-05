import type { DataClient } from '@eightyfourthousand/data-access';
import { readPublishHistory } from './history';
import type { WorkIdentity } from './read-published';

interface FakeTables {
  work_versions?: {
    data?: Record<string, unknown>[];
    error?: { message: string };
  };
  publish_jobs?: {
    data?: Record<string, unknown>[];
    error?: { message: string };
  };
}

/**
 * A chainable stand-in for the PostgREST builder.
 *
 * Every method returns `this` and the object is awaitable, which is enough for these reads:
 * they only ever chain filters and then await. Filter arguments are recorded so the tests
 * can assert on the ones that carry meaning — chiefly that job warnings are read only for
 * succeeded jobs.
 */
const fakeClient = (
  tables: FakeTables,
  rpc: {
    data?: { id: string; full_name: string | null }[];
    error?: { message: string };
  } = {},
) => {
  const calls: { table: string; filters: unknown[][] }[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];

  const client = {
    from(table: string) {
      const entry = { table, filters: [] as unknown[][] };
      calls.push(entry);
      const result = tables[table as keyof FakeTables] ?? { data: [] };

      const builder: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: result.data ?? null,
            error: result.error ?? null,
          }).then(resolve),
      };
      for (const method of ['select', 'eq', 'order', 'range', 'not']) {
        builder[method] = (...args: unknown[]) => {
          entry.filters.push([method, ...args]);
          return builder;
        };
      }
      return builder;
    },
    rpc(name: string, args: unknown) {
      rpcCalls.push({ name, args });
      return Promise.resolve({
        data: rpc.data ?? null,
        error: rpc.error ?? null,
      });
    },
  };

  return { client: client as unknown as DataClient, calls, rpcCalls };
};

const WORK: WorkIdentity = {
  uuid: 'work-1',
  toh: 'toh1',
  title: 'A work',
  publicationVersion: null,
  publishedVersionUuid: 'v2',
};

const versionRow = (overrides: Record<string, unknown> = {}) => ({
  uuid: 'v1',
  version: '0.0.1',
  published_at: '2026-08-01T10:00:00+00:00',
  published_by: 'user-1',
  notes: null,
  ...overrides,
});

describe('readPublishHistory', () => {
  it('marks only the version the work points at as live', async () => {
    const { client } = fakeClient({
      work_versions: {
        data: [
          versionRow({ uuid: 'v2', version: '0.0.2' }),
          versionRow({ uuid: 'v1', version: '0.0.1' }),
        ],
      },
    });

    const history = await readPublishHistory({ client, work: WORK });

    expect(history?.versions.map((v) => [v.uuid, v.isLive])).toEqual([
      ['v2', true],
      ['v1', false],
    ]);
  });

  it('distinguishes a clean publish from one whose warnings were never recorded', async () => {
    // The distinction the UI depends on: [] is "the job recorded no warnings", null is "no
    // job row to read". Collapsing them would present an unknown validation status as clean.
    const { client } = fakeClient({
      work_versions: {
        data: [
          versionRow({ uuid: 'v2', version: '0.0.2' }),
          versionRow({ uuid: 'v1', version: '0.0.1' }),
        ],
      },
      publish_jobs: {
        data: [{ version_uuid: 'v2', warnings: [] }],
      },
    });

    const history = await readPublishHistory({ client, work: WORK });

    expect(history?.versions[0].warnings).toEqual([]);
    expect(history?.versions[1].warnings).toBeNull();
  });

  it('reads warnings only from succeeded jobs', async () => {
    // A failed attempt's findings describe a version that was rolled back, so they must
    // never be shown as the published state of anything.
    const { client, calls } = fakeClient({
      work_versions: { data: [versionRow()] },
    });

    await readPublishHistory({ client, work: WORK });

    const jobs = calls.find((call) => call.table === 'publish_jobs');
    expect(jobs?.filters).toContainEqual(['eq', 'status', 'succeeded']);
  });

  it('resolves publisher names and requests each publisher once', async () => {
    const { client, rpcCalls } = fakeClient(
      {
        work_versions: {
          data: [
            versionRow({ uuid: 'v2', published_by: 'user-1' }),
            versionRow({ uuid: 'v1', published_by: 'user-1' }),
          ],
        },
      },
      { data: [{ id: 'user-1', full_name: 'Dawa Lhamo' }] },
    );

    const history = await readPublishHistory({ client, work: WORK });

    expect(rpcCalls).toEqual([
      { name: 'publisher_display_names', args: { p_ids: ['user-1'] } },
    ]);
    expect(history?.versions.map((v) => v.publisher)).toEqual([
      'Dawa Lhamo',
      'Dawa Lhamo',
    ]);
  });

  it('leaves a service-account publish unattributed without asking for a name', async () => {
    const { client, rpcCalls } = fakeClient({
      work_versions: { data: [versionRow({ published_by: null })] },
    });

    const history = await readPublishHistory({ client, work: WORK });

    expect(history?.versions[0].publisher).toBeNull();
    expect(history?.versions[0].publishedBy).toBeNull();
    // No ids to resolve, so the definer function is not called at all.
    expect(rpcCalls).toEqual([]);
  });

  it('still returns the versions when the name lookup fails', async () => {
    // Not knowing who published a version is a smaller loss than showing no history.
    const { client } = fakeClient(
      { work_versions: { data: [versionRow()] } },
      { error: { message: 'Permission denied: editor.admin required' } },
    );

    const history = await readPublishHistory({ client, work: WORK });

    expect(history?.versions).toHaveLength(1);
    expect(history?.versions[0].publisher).toBeNull();
  });

  it('suggests the patch bump of the highest existing label', async () => {
    const { client } = fakeClient({
      work_versions: {
        data: [
          // Deliberately not in label order: the suggestion must come from the highest
          // SemVer, not from whichever row was published most recently.
          versionRow({ uuid: 'v2', version: '0.0.9' }),
          versionRow({ uuid: 'v3', version: '0.1.0' }),
          versionRow({ uuid: 'v1', version: '0.0.1' }),
        ],
      },
    });

    const history = await readPublishHistory({ client, work: WORK });

    expect(history?.suggestedVersion).toBe('0.1.1');
    expect(history?.suggestedVersionError).toBeNull();
  });

  it('seeds the first publish from the legacy publicationVersion', async () => {
    const { client } = fakeClient({ work_versions: { data: [] } });

    const history = await readPublishHistory({
      client,
      work: { ...WORK, publicationVersion: '1.2.3' },
    });

    expect(history?.versions).toEqual([]);
    expect(history?.suggestedVersion).toBe('1.2.4');
  });

  it('reports why it cannot suggest a label rather than inventing one', async () => {
    // `1.0` could mean 1.0.0 or 1.0.x; guessing is exactly what nextVersion refuses to do.
    const { client } = fakeClient({
      work_versions: { data: [versionRow({ version: '1.0' })] },
    });

    const history = await readPublishHistory({ client, work: WORK });

    expect(history?.suggestedVersion).toBeNull();
    expect(history?.suggestedVersionError).toContain('1.0');
  });

  it('returns null when the version read itself fails', async () => {
    const { client } = fakeClient({
      work_versions: { error: { message: 'boom' } },
    });

    expect(await readPublishHistory({ client, work: WORK })).toBeNull();
  });
});
