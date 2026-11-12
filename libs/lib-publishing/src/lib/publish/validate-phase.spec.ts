/**
 * DEV-881 acceptance: "Publishing no longer refreshes anything across the whole library."
 *
 * Publishing used to call the corpus-wide glossary refresh RPC before validating, because
 * the draft glossary index was a materialized view refreshed hourly. Draft glossary terms are
 * now computed live from the glossary tables, so a publish must make no `refresh_*` RPC at
 * all, with default options.
 *
 * The specs drive the validate phase directly and through `tickJob` (the entry point every
 * publish goes through), with a client that records every RPC.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import type { PublishJob } from '../types';
import type { PhaseContext } from './context';
import { tickJob } from './tick';
import { runValidatePhase } from './validate-phase';

type RpcCall = { name: string; args: unknown };

const jobRow = (overrides: Record<string, unknown> = {}) => ({
  uuid: 'job-1',
  work_uuid: 'work-1',
  version_uuid: null,
  version: null,
  status: 'running',
  phase: 'validate',
  cursor: {},
  chunks: [],
  files: [],
  counts: {},
  warnings: [],
  errors: [],
  error: null,
  attempts: 1,
  created_at: '2026-11-09T00:00:00Z',
  updated_at: '2026-11-09T00:00:00Z',
  finished_at: null,
  ...overrides,
});

const job = (overrides: Partial<PublishJob> = {}): PublishJob => ({
  uuid: 'job-1',
  workUuid: 'work-1',
  versionUuid: null,
  version: null,
  status: 'running',
  phase: 'validate',
  cursor: {},
  chunks: [],
  files: [],
  counts: {},
  warnings: [],
  errors: [],
  error: null,
  attempts: 1,
  createdAt: '2026-11-09T00:00:00Z',
  updatedAt: '2026-11-09T00:00:00Z',
  finishedAt: null,
  ...overrides,
});

const finding = (rule: string) => ({
  severity: 'error',
  rule,
  message: rule,
  count: 0,
  subjects: [],
});

/**
 * A DataClient that records every RPC and table write. `validate_work_for_publish` answers
 * with `validation`; `claim_publish_job` hands back a job in the validate phase; any other
 * RPC succeeds with no data, so a stray `refresh_*` call is recorded rather than throwing.
 */
const createRecordingClient = ({
  validation,
}: {
  validation: {
    ok: boolean;
    errors?: unknown[];
    warnings?: unknown[];
  };
}) => {
  const rpcCalls: RpcCall[] = [];
  const tableCalls: string[] = [];

  const builder = (table: string, row: unknown) => {
    const chain: Record<string, unknown> = {};
    for (const method of [
      'select',
      'update',
      'insert',
      'delete',
      'eq',
      'in',
      'is',
      'order',
      'range',
      'limit',
    ]) {
      chain[method] = (...args: unknown[]) => {
        tableCalls.push(`${table}.${method}(${args.length})`);
        return chain;
      };
    }
    chain['maybeSingle'] = async () => ({ data: row, error: null });
    chain['single'] = async () => ({ data: row, error: null });
    chain['then'] = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: row, error: null }).then(resolve, reject);
    return chain;
  };

  const client = {
    rpc: jest.fn(async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      if (name === 'validate_work_for_publish') {
        return {
          data: { errors: [], warnings: [], ...validation },
          error: null,
        };
      }
      if (name === 'claim_publish_job') {
        return { data: jobRow(), error: null };
      }
      return { data: null, error: null };
    }),
    from: jest.fn((table: string) => builder(table, jobRow())),
  };

  return {
    client: client as unknown as DataClient,
    rpcCalls,
    tableCalls,
    rpcNames: () => rpcCalls.map((call) => call.name),
  };
};

const context = (client: DataClient): PhaseContext => ({
  client,
  job: job(),
  clock: () => new Date('2026-11-09T00:00:00Z'),
  makeUuid: () => 'uuid-1',
  outOfBudget: () => false,
});

const refreshCalls = (names: string[]) =>
  names.filter((name) => /refresh/i.test(name));

describe('publish validate phase (DEV-881: nothing is refreshed library-wide)', () => {
  it('validates the work and makes no refresh_* RPC, with default options', async () => {
    const { client, rpcNames } = createRecordingClient({
      validation: { ok: true },
    });

    const result = await runValidatePhase(context(client));

    expect(rpcNames()).toContain('validate_work_for_publish');
    expect(refreshCalls(rpcNames())).toEqual([]);
    expect(result.phase).toBe('snapshot');
    expect(result.status).toBe('running');
  });

  it("asks the database to validate exactly the job's work", async () => {
    const { client, rpcCalls } = createRecordingClient({
      validation: { ok: true },
    });

    await runValidatePhase(context(client));

    const validate = rpcCalls.filter(
      (call) => call.name === 'validate_work_for_publish',
    );
    expect(validate).toHaveLength(1);
    expect(validate[0].args).toEqual({ p_work_uuid: 'work-1' });
  });

  it('still fails the job on a validation error, without refreshing anything', async () => {
    const { client, rpcNames } = createRecordingClient({
      validation: {
        ok: false,
        errors: [finding('glossary-instance-unresolved')],
      },
    });

    const result = await runValidatePhase(context(client));

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/Validation failed/);
    expect(refreshCalls(rpcNames())).toEqual([]);
  });

  it('carries the validation warnings onto the job unchanged', async () => {
    const warnings = [{ ...finding('toh-missing'), severity: 'warning' }];
    const { client } = createRecordingClient({
      validation: { ok: true, warnings },
    });

    const result = await runValidatePhase(context(client));

    expect(result.warnings).toEqual(warnings);
  });

  it('a whole tick (claim, validate, then whatever follows) makes no refresh_* RPC', async () => {
    const { client, rpcNames } = createRecordingClient({
      // Fail validation so the tick ends in the validate phase: this spec is about the
      // validate phase, and later phases need real storage and snapshot rows.
      validation: { ok: false, errors: [finding('work-not-found')] },
    });

    const result = await tickJob({
      client,
      jobUuid: 'job-1',
      newUuid: () => 'uuid-1',
      now: () => new Date('2026-11-09T00:00:00Z'),
    });

    expect(result.done).toBe(true);
    expect(rpcNames()).toEqual(
      expect.arrayContaining([
        'claim_publish_job',
        'validate_work_for_publish',
      ]),
    );
    expect(refreshCalls(rpcNames())).toEqual([]);
  });
});
