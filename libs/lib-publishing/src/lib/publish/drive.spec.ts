import type { DataClient } from '@eightyfourthousand/data-access';
import { drivePublish } from './drive';
import { getJob } from '../jobs';
import { startPublish } from './start';
import { tickJob } from './tick';
import type { PublishJob, PublishPhase } from '../types';

jest.mock('../jobs', () => ({ getJob: jest.fn() }));
jest.mock('./start', () => ({ startPublish: jest.fn() }));
jest.mock('./tick', () => ({ tickJob: jest.fn(), DEFAULT_TICK_BUDGET_MS: 20_000 }));

const mockGetJob = getJob as jest.MockedFunction<typeof getJob>;
const mockStartPublish = startPublish as jest.MockedFunction<typeof startPublish>;
const mockTickJob = tickJob as jest.MockedFunction<typeof tickJob>;

const job = (overrides: Partial<PublishJob> = {}): PublishJob => ({
  uuid: 'job-1',
  workUuid: 'work-1',
  versionUuid: null,
  version: null,
  status: 'running',
  phase: 'validate' as PublishPhase,
  cursor: {},
  chunks: [],
  files: [],
  counts: {},
  warnings: [],
  errors: [],
  error: null,
  attempts: 1,
  createdAt: '2026-08-10T00:00:00Z',
  updatedAt: '2026-08-10T00:00:00Z',
  finishedAt: null,
  ...overrides,
});

const client = {} as DataClient;
const options = { work: 'toh1' };

beforeEach(() => {
  jest.resetAllMocks();
});

describe('drivePublish', () => {
  it('reports a work that does not exist', async () => {
    mockStartPublish.mockResolvedValue({ ok: false, reason: 'work-not-found' });

    expect(await drivePublish({ client, options })).toEqual({
      ok: false,
      reason: 'work-not-found',
    });
    expect(mockTickJob).not.toHaveBeenCalled();
  });

  it('reports a publish already in flight, carrying the job that holds it', async () => {
    const running = job({ phase: 'artifact' });
    mockStartPublish.mockResolvedValue({
      ok: false,
      reason: 'already-running',
      job: running,
    });

    expect(await drivePublish({ client, options })).toEqual({
      ok: false,
      reason: 'already-running',
      job: running,
    });
  });

  it('ticks until done and returns the re-read job', async () => {
    mockStartPublish.mockResolvedValue({
      ok: true,
      adopted: false,
      result: { job: job(), done: false, advanced: [] },
    });
    mockTickJob.mockResolvedValue({
      job: job({ phase: 'flip' }),
      done: true,
      advanced: ['flip'],
    });

    // The tick that finishes the job returns its pre-flip copy; the row carries the final
    // status and version, so the driver must re-read rather than hand back what it has.
    const settled = job({ phase: 'done', status: 'succeeded', version: '0.0.2' });
    mockGetJob.mockResolvedValue(settled);

    expect(await drivePublish({ client, options })).toEqual({ ok: true, job: settled });
  });

  it('falls back to the last tick when the job row cannot be re-read', async () => {
    const finished = job({ phase: 'done', status: 'succeeded' });
    mockStartPublish.mockResolvedValue({
      ok: true,
      adopted: false,
      result: { job: finished, done: true, advanced: ['flip'] },
    });
    mockGetJob.mockResolvedValue(null);

    expect(await drivePublish({ client, options })).toEqual({ ok: true, job: finished });
  });

  it('gives up instead of spinning when ticks stop making progress', async () => {
    const stuck = job({ phase: 'artifact' });
    mockStartPublish.mockResolvedValue({
      ok: true,
      adopted: false,
      result: { job: stuck, done: false, advanced: [] },
    });
    // A tick that cannot claim the job returns `done: false` having changed nothing.
    mockTickJob.mockResolvedValue({ job: stuck, done: false, advanced: [] });

    const waits: number[] = [];
    const result = await drivePublish({
      client,
      options,
      wait: async (ms) => void waits.push(ms),
    });

    expect(result).toEqual({ ok: false, reason: 'stalled', job: stuck });
    expect(waits).toHaveLength(2);
    expect(mockGetJob).not.toHaveBeenCalled();
  });

  it('keeps ticking while the cursor is still moving', async () => {
    mockStartPublish.mockResolvedValue({
      ok: true,
      adopted: false,
      result: {
        job: job({ phase: 'artifact', cursor: { section: 'passages', offset: 0, chunk: 1 } }),
        done: false,
        advanced: [],
      },
    });
    mockTickJob
      .mockResolvedValueOnce({
        job: job({
          phase: 'artifact',
          cursor: { section: 'passages', offset: 1000, chunk: 2 },
        }),
        done: false,
        advanced: [],
      })
      .mockResolvedValueOnce({
        job: job({ phase: 'done', status: 'succeeded' }),
        done: true,
        advanced: ['flip'],
      });
    mockGetJob.mockResolvedValue(job({ phase: 'done', status: 'succeeded' }));

    const waits: number[] = [];
    const result = await drivePublish({
      client,
      options,
      wait: async (ms) => void waits.push(ms),
    });

    expect(result.ok).toBe(true);
    expect(waits).toHaveLength(0);
    expect(mockTickJob).toHaveBeenCalledTimes(2);
  });
});
