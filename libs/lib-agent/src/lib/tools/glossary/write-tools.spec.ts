import {
  additionKey,
  applyGlossaryInstances,
  hasPermission,
  loadGlossaryReview,
  matchGlossaryInstances,
  resolveAnchors,
  triageReview,
  writeReviewBatch,
  writeReviewFile,
  type DataClient,
  type GlossaryPlan,
  type ReviewBatch,
} from '@eightyfourthousand/data-access';
import {
  MCP_WRITE_EVENT,
  withInstrumentation,
  type McpInstrumentationEvent,
} from '../../instrumentation';
import type { McpToolDefinition } from '../../types';
import { createGlossaryResolveTools } from './index';

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  hasPermission: jest.fn(),
  loadGlossaryReview: jest.fn(),
  writeReviewBatch: jest.fn(),
  writeReviewFile: jest.fn(),
  applyGlossaryInstances: jest.fn(),
}));

const WORK = '3f0c1c52-8a55-4a0e-9d57-5b0a6d3c9f11';
const client = {} as DataClient;

const plan = (content = 'the lord of death met the lord'): GlossaryPlan => {
  const input = {
    passages: [
      {
        uuid: 'p0',
        content,
        label: '1.1',
        sort: 1,
        type: 'translation',
      },
    ],
    annotations: [],
    terms: [
      {
        uuid: 'lord',
        authorityUuid: 'a-lord',
        english: 'lord',
        alternatives: [],
      },
    ],
    termOf: new Map([['lord', 'lord']]),
  };
  return {
    workUuid: WORK,
    input,
    matches: matchGlossaryInstances(input),
    anchors: resolveAnchors(input),
    timings: { readMs: 1, matchMs: 1 },
  };
};

const loaded = (batches: ReviewBatch[] = [], content?: string) => {
  const p = plan(content);
  return {
    data: {
      plan: p,
      batches,
      triage: triageReview({ plan: p, batches }),
      warnings: [],
    },
  };
};

const editorRule: ReviewBatch = {
  version: 1,
  batchId: 'b1',
  workUuid: WORK,
  recordedAt: '2026-10-13T00:00:00.000Z',
  recordedBy: 'u',
  decider: 'editor',
  rules: [{ termUuid: 'lord', verdict: 'accept' }],
  instances: [],
  additions: [],
};

const parse = (result: unknown) =>
  JSON.parse((result as { content: { text: string }[] }).content[0].text);

const call = (tool: McpToolDefinition, args: unknown) =>
  (tool.handler as unknown as (a: unknown, e: unknown) => Promise<unknown>)(
    args,
    {},
  );

const tools = createGlossaryResolveTools(client, 'user-1');
const byName = (name: string) =>
  tools.find((t) => t.name === name) as McpToolDefinition;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(hasPermission).mockResolvedValue(true);
  jest.mocked(loadGlossaryReview).mockResolvedValue(loaded() as never);
  jest.mocked(writeReviewBatch).mockResolvedValue({ path: 'x' });
  jest
    .mocked(writeReviewFile)
    .mockResolvedValue({ path: 'f', url: 'https://signed' });
});

describe('record-glossary-review and apply-glossary-instances', () => {
  it('marks plan read-only and record and apply as writes', () => {
    expect(tools.map((t) => [t.name, t.annotations?.readOnlyHint])).toEqual([
      ['plan-glossary-instances', true],
      ['record-glossary-review', false],
      ['apply-glossary-instances', false],
    ]);
  });

  it('gates plan on editor.read and the writes on editor.edit', async () => {
    jest.mocked(hasPermission).mockResolvedValue(false);
    for (const [name, permission] of [
      ['plan-glossary-instances', 'editor.read'],
      ['record-glossary-review', 'editor.edit'],
      ['apply-glossary-instances', 'editor.edit'],
    ]) {
      const result = (await call(byName(name), {
        workUuid: WORK,
        decider: 'model',
      })) as { isError: boolean };
      expect(result.isError).toBe(true);
      expect(jest.mocked(hasPermission)).toHaveBeenLastCalledWith({
        client,
        permission,
      });
    }
    expect(loadGlossaryReview).not.toHaveBeenCalled();
  });

  it('records valid decisions as one batch and returns the rest as rejected', async () => {
    const key = plan().matches[0].key;
    const out = parse(
      await call(byName('record-glossary-review'), {
        workUuid: WORK,
        decider: 'model',
        model: 'claude',
        rules: [{ termUuid: 'nope', verdict: 'accept' }],
        instances: [
          { key, verdict: 'skip', reason: 'lord of death is Yama' },
          { key: 'c-missing', verdict: 'accept' },
          { key, verdict: 'accept', span: 'king' },
        ],
      }),
    );
    expect(out.recorded).toEqual({ rules: 0, instances: 1, additions: 0 });
    expect(out.rejected.map((r: { reason: string }) => r.reason)).toEqual([
      'term is not in the glossary',
      'no candidate has this key; re-plan',
      '"king" is not in the passage',
    ]);
    const batch = jest.mocked(writeReviewBatch).mock.calls[0][0].batch;
    expect(batch).toMatchObject({
      workUuid: WORK,
      recordedBy: 'user-1',
      decider: 'model',
      model: 'claude',
    });
    // A model decision waits for its term's sample.
    expect(out.review.byState).toEqual({
      'awaiting-sample': 1,
      undecided: 1,
    });
  });

  it('records nothing on a dry run', async () => {
    const out = parse(
      await call(byName('record-glossary-review'), {
        workUuid: WORK,
        decider: 'editor',
        rules: [{ termUuid: 'lord', verdict: 'accept' }],
        dryRun: true,
      }),
    );
    expect(writeReviewBatch).not.toHaveBeenCalled();
    expect(out).toMatchObject({
      dryRun: true,
      wouldRecord: { rules: 1 },
      review: { byState: { accepted: 2 } },
    });
  });

  it('applies the accepted items and stores the undo handle', async () => {
    jest
      .mocked(loadGlossaryReview)
      .mockResolvedValue(loaded([editorRule]) as never);
    jest.mocked(applyGlossaryInstances).mockResolvedValue({
      dryRun: false,
      chunks: [
        {
          passages: 1,
          instances: 2,
          applied: true,
          annotationUuids: ['n1', 'n2'],
        },
      ],
      appliedInstances: 2,
      alreadyApplied: 0,
      staleInstances: 0,
      skippedInstances: 0,
      failedInstances: 0,
      remainingInstances: 0,
      warnings: [],
    });
    const out = parse(
      await call(byName('apply-glossary-instances'), { workUuid: WORK }),
    );
    const sent = jest.mocked(applyGlossaryInstances).mock.calls[0][0];
    expect(
      sent.items.map((i) => [i.start, i.end, i.termUuid, i.authorityUuid]),
    ).toEqual([
      [4, 8, 'lord', 'a-lord'],
      [26, 30, 'lord', 'a-lord'],
    ]);
    expect(out).toMatchObject({
      inScope: 2,
      appliedInstances: 2,
      remaining: 0,
      undo: { annotations: 2, path: 'f', annotationUuids: ['n1', 'n2'] },
    });
    expect(jest.mocked(writeReviewFile).mock.calls[0][0]).toMatchObject({
      folder: 'applied',
    });
    expect(sent.items[0].text).toBe('lord');
    expect(sent.termOf?.get('lord')).toBe('lord');
    expect(sent.budgetMs).toBeGreaterThan(0);
  });

  it('returns every uuid written when the undo file cannot be stored', async () => {
    jest
      .mocked(loadGlossaryReview)
      .mockResolvedValue(loaded([editorRule]) as never);
    jest.mocked(writeReviewFile).mockResolvedValue({ error: 'denied' });
    const uuids = Array.from({ length: 60 }, (_, i) => `n${i}`);
    jest.mocked(applyGlossaryInstances).mockResolvedValue({
      dryRun: false,
      chunks: [
        { passages: 1, instances: 60, applied: true, annotationUuids: uuids },
      ],
      appliedInstances: 60,
      alreadyApplied: 0,
      staleInstances: 0,
      skippedInstances: 0,
      failedInstances: 0,
      remainingInstances: 0,
      warnings: [],
    });
    const out = parse(
      await call(byName('apply-glossary-instances'), { workUuid: WORK }),
    );
    expect(out.undo).toMatchObject({ error: 'denied', annotationUuids: uuids });
  });

  it('lets only an editor change the audit settings', async () => {
    const refused = (await call(byName('record-glossary-review'), {
      workUuid: WORK,
      decider: 'model',
      settings: { sampleSize: 0 },
    })) as { isError: boolean };
    expect(refused.isError).toBe(true);
    expect(writeReviewBatch).not.toHaveBeenCalled();

    const out = parse(
      await call(byName('record-glossary-review'), {
        workUuid: WORK,
        decider: 'editor',
        settings: { sampleSize: 3 },
      }),
    );
    expect(out.recorded).toMatchObject({ settings: { sampleSize: 3 } });
    expect(
      jest.mocked(writeReviewBatch).mock.calls[0][0].batch.settings,
    ).toEqual({ sampleSize: 3 });
  });

  it('rejects a span away from its candidate, and fingerprints additions', async () => {
    const content = `the lord of death${' and so on'.repeat(5)}, the lord`;
    jest
      .mocked(loadGlossaryReview)
      .mockResolvedValue(loaded([], content) as never);
    const key = plan(content).matches[1].key;
    const out = parse(
      await call(byName('record-glossary-review'), {
        workUuid: WORK,
        decider: 'editor',
        instances: [{ key, verdict: 'accept', span: 'the lord of death' }],
        additions: [
          { passageUuid: 'p0', text: 'lord of death', termUuid: 'lord' },
        ],
      }),
    );
    expect(out.rejected).toEqual([
      expect.objectContaining({
        reason: '"the lord of death" is not at the candidate',
      }),
    ]);
    const batch = jest.mocked(writeReviewBatch).mock.calls[0][0].batch;
    expect(batch.additions[0].fingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it("accepts an instance decision on an added instance's key", async () => {
    const added = {
      passageUuid: 'p0',
      text: 'lord of death',
      termUuid: 'lord',
    };
    jest.mocked(loadGlossaryReview).mockResolvedValue(
      loaded([
        {
          ...editorRule,
          batchId: 'b2',
          rules: [],
          decider: 'model',
          additions: [added],
        },
      ]) as never,
    );
    const out = parse(
      await call(byName('record-glossary-review'), {
        workUuid: WORK,
        decider: 'editor',
        instances: [{ key: additionKey(added), verdict: 'skip' }],
      }),
    );
    expect(out.rejected).toEqual([]);
    expect(out.recorded.instances).toBe(1);
  });

  it('rejects an addition over a candidate, and returns the keys of recorded ones', async () => {
    const out = parse(
      await call(byName('record-glossary-review'), {
        workUuid: WORK,
        decider: 'editor',
        additions: [
          { passageUuid: 'p0', text: 'lord', termUuid: 'lord' },
          { passageUuid: 'p0', text: 'lord of death', termUuid: 'lord' },
        ],
      }),
    );
    expect(out.rejected).toEqual([
      expect.objectContaining({ entry: 'additions[0]' }),
    ]);
    expect(out.additionKeys).toEqual([
      additionKey({
        passageUuid: 'p0',
        text: 'lord of death',
        termUuid: 'lord',
      }),
    ]);
  });

  it('lists only the plan tool without write access', () => {
    expect(
      createGlossaryResolveTools(client, 'user-1', { write: false }).map(
        (t) => t.name,
      ),
    ).toEqual(['plan-glossary-instances']);
  });

  it('warns to re-plan when an outcome is unknown', async () => {
    jest
      .mocked(loadGlossaryReview)
      .mockResolvedValue(loaded([editorRule]) as never);
    jest.mocked(applyGlossaryInstances).mockResolvedValue({
      dryRun: false,
      chunks: [
        { passages: 1, instances: 2, applied: 'unknown', annotationUuids: [] },
      ],
      appliedInstances: 0,
      alreadyApplied: 0,
      staleInstances: 0,
      skippedInstances: 0,
      failedInstances: 2,
      remainingInstances: 0,
      stopped: 'unknown',
      warnings: [],
    });
    const out = parse(
      await call(byName('apply-glossary-instances'), { workUuid: WORK }),
    );
    expect(out.stopped).toBe('unknown');
    expect(out.warning).toMatch(/Re-plan/);
  });

  it('reports record and apply as mcp_write events, and not on a dry run', async () => {
    jest.mocked(applyGlossaryInstances).mockResolvedValue({
      dryRun: false,
      chunks: [],
      appliedInstances: 0,
      alreadyApplied: 0,
      staleInstances: 0,
      skippedInstances: 0,
      failedInstances: 0,
      remainingInstances: 0,
      warnings: [],
    });
    const events: McpInstrumentationEvent[] = [];
    const wrapped = withInstrumentation(tools, {
      emit: (e) => void events.push(e),
      distinctId: 'user-1',
    });
    const named = (name: string) =>
      wrapped.find((t) => t.name === name) as McpToolDefinition;
    await call(named('plan-glossary-instances'), { workUuid: WORK });
    await call(named('record-glossary-review'), {
      workUuid: WORK,
      decider: 'editor',
      rules: [{ tier: 'auto', verdict: 'accept' }],
    });
    await call(named('apply-glossary-instances'), { workUuid: WORK });
    await call(named('apply-glossary-instances'), {
      workUuid: WORK,
      dryRun: true,
    });
    expect(
      events
        .filter((e) => e.event === MCP_WRITE_EVENT)
        .map((e) => [e.properties.tool_name, e.properties.work_uuid]),
    ).toEqual([
      ['record-glossary-review', WORK],
      ['apply-glossary-instances', WORK],
    ]);
  });
});
