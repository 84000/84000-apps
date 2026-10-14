import {
  hasPermission,
  loadGlossaryReview,
  matchGlossaryInstances,
  resolveAnchors,
  triageReview,
  writeReviewFile,
  type DataClient,
  type GlossaryPlan,
  type ReviewBatch,
} from '@eightyfourthousand/data-access';
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

const plan = (): GlossaryPlan => {
  const input = {
    passages: [
      {
        uuid: 'p0',
        content: 'the lord of death met the lord',
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

const loaded = (batches: ReviewBatch[] = []) => {
  const p = plan();
  return {
    data: {
      plan: p,
      batches,
      triage: triageReview({ plan: p, batches }),
      warnings: [],
    },
  };
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
  jest
    .mocked(writeReviewFile)
    .mockResolvedValue({ path: 'f', url: 'https://signed' });
});

describe('plan-glossary-instances', () => {
  it('is read-only', () => {
    expect(byName('plan-glossary-instances').annotations?.readOnlyHint).toBe(
      true,
    );
  });

  it('needs editor.read', async () => {
    jest.mocked(hasPermission).mockResolvedValue(false);
    const result = (await call(byName('plan-glossary-instances'), {
      workUuid: WORK,
    })) as { isError: boolean };
    expect(result.isError).toBe(true);
    expect(hasPermission).toHaveBeenCalledWith({
      client,
      permission: 'editor.read',
    });
    expect(loadGlossaryReview).not.toHaveBeenCalled();
  });

  it('plans: totals, term rows with examples, and a download', async () => {
    const out = parse(
      await call(byName('plan-glossary-instances'), {
        workUuid: WORK,
        view: 'terms',
        download: true,
      }),
    );
    expect(out.byState).toEqual({ undecided: 2 });
    expect(out.terms).toHaveLength(1);
    expect(out.terms[0]).toMatchObject({
      termUuid: 'lord',
      states: { undecided: 2 },
      flags: ['ordinary-word'],
    });
    expect(out.terms[0].examples[0].context).toContain('[[lord]]');
    expect(out.download).toEqual({ path: 'f', url: 'https://signed' });
    expect(jest.mocked(writeReviewFile).mock.calls[0][0]).toMatchObject({
      folder: 'candidates',
    });
  });

  it('pages candidates', async () => {
    const out = parse(
      await call(byName('plan-glossary-instances'), {
        workUuid: WORK,
        view: 'candidates',
        limit: 1,
      }),
    );
    expect(out.candidates).toHaveLength(1);
    expect(out).toMatchObject({ total: 2, nextCursor: '1' });
  });
});
