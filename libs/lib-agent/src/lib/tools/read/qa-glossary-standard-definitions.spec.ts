import { createQaGlossaryStandardDefinitionsTool } from './qa-glossary-standard-definitions';
import type { DataClient } from '@eightyfourthousand/data-access';

import { getStandardDefinitionGaps } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  getStandardDefinitionGaps: jest.fn(),
}));
const mocked = jest.mocked(getStandardDefinitionGaps);

const WORK = '3b8a1c2e-4d5f-4a6b-8c7d-9e0f1a2b3c4d';

describe('qa-glossary-standard-definitions tool', () => {
  const client = {} as DataClient;
  const tool = createQaGlossaryStandardDefinitionsTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('qa-glossary-standard-definitions');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('returns the report', async () => {
    const report = {
      workUuid: WORK,
      placeholders: 2,
      covered: 1,
      gaps: [
        {
          glossaryUuid: 'g-1',
          authorityUuid: 'a-1',
          term: 'karma',
          headword: 'las',
          definition: 'Use standard',
          definitionRend: 'overrideWithStandard',
        },
      ],
    };
    mocked.mockResolvedValue(report);

    const result = await tool.handler({ workUuid: WORK }, extra);

    expect(mocked).toHaveBeenCalledWith({ client, workUuid: WORK });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(report, null, 2),
    });
  });

  it('returns an error result when the read fails', async () => {
    mocked.mockRejectedValue(new Error('Failed to read glossary entries'));

    const result = await tool.handler({ workUuid: WORK }, extra);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Failed to read glossary entries',
    });
  });
});
