import { createUpdateGlossaryDefinitionTool } from './update-glossary-definition';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  hasPermission,
  updateGlossaryDefinition,
} from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  DEFINITION_RENDS: [
    'incompatibleWithStandard',
    'overrideWithStandard',
    'appendWithStandard',
    'prependWithStandard',
    'bothWithStandard',
  ],
  hasPermission: jest.fn(),
  updateGlossaryDefinition: jest.fn(),
}));
const mockedPermission = jest.mocked(hasPermission);
const mockedUpdate = jest.mocked(updateGlossaryDefinition);

const W = '11111111-1111-4111-8111-111111111111';
const G = '22222222-2222-4222-8222-222222222222';

const args = {
  workUuid: W,
  glossaryUuid: G,
  definition: 'A new definition.',
  expectedDefinition: 'Use standard',
};

describe('update-glossary-definition tool', () => {
  const client = {} as DataClient;
  const tool = createUpdateGlossaryDefinitionTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('is a write tool', () => {
    expect(tool.name).toBe('update-glossary-definition');
    expect(tool.annotations?.readOnlyHint).toBe(false);
  });

  it('refuses without editor.edit', async () => {
    mockedPermission.mockResolvedValue(false);
    const result = await tool.handler(args, extra);
    expect(mockedPermission).toHaveBeenCalledWith({
      client,
      permission: 'editor.edit',
    });
    expect(result.isError).toBe(true);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('leaves the rend to the data-access default and returns the change', async () => {
    mockedPermission.mockResolvedValue(true);
    const change = {
      ok: true as const,
      dryRun: true,
      glossaryUuid: G,
      before: {
        definition: 'Use standard',
        definitionRend: 'overrideWithStandard',
      },
      after: {
        definition: 'A new definition.',
        definitionRend: 'incompatibleWithStandard',
      },
    };
    mockedUpdate.mockResolvedValue(change);

    const result = await tool.handler({ ...args, dryRun: true }, extra);

    expect(mockedUpdate).toHaveBeenCalledWith({
      client,
      ...args,
      definitionRend: undefined,
      dryRun: true,
    });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(change, null, 2),
    });
  });

  it('reports a refused change with the current state', async () => {
    mockedPermission.mockResolvedValue(true);
    mockedUpdate.mockResolvedValue({
      ok: false,
      error: 'changed',
      current: { definition: 'x', definitionRend: null },
    });
    const result = await tool.handler(args, extra);
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('Current:');
  });
});
