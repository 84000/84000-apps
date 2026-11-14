import type { DataClient } from '@eightyfourthousand/data-access';
import { getGlossaryInstances } from '@eightyfourthousand/data-access';
import { createReadTools } from './index';

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getGlossaryInstances: jest.fn(),
}));
// Other read tools import the ssr entrypoint, which loads next/server; jest's
// node environment has no Request global for it. None of them run here.
jest.mock('@eightyfourthousand/data-access/ssr', () => ({}));

const mocked = jest.mocked(getGlossaryInstances);

const callGlossaryInstances = async (
  options: Parameters<typeof createReadTools>[1],
  args: Record<string, unknown>,
) => {
  const client = {} as DataClient;
  const tool = createReadTools(client, options).find(
    ({ name }) => name === 'get-glossary-instances',
  );
  if (!tool) throw new Error('get-glossary-instances is not registered');
  await tool.handler(args as never, {} as never);
  return mocked.mock.calls[0][0].source;
};

describe('createReadTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.mockResolvedValue([]);
  });

  it('reads published glossary instances by default', async () => {
    await expect(
      callGlossaryInstances(undefined, { uuid: 'w1' }),
    ).resolves.toBe('published');
  });

  it('applies glossaryInstancesSource when the call gives no source', async () => {
    await expect(
      callGlossaryInstances(
        { glossaryInstancesSource: 'draft' },
        { uuid: 'w1' },
      ),
    ).resolves.toBe('draft');
  });

  it("lets the call's source override glossaryInstancesSource", async () => {
    await expect(
      callGlossaryInstances(
        { glossaryInstancesSource: 'draft' },
        { uuid: 'w1', source: 'published' },
      ),
    ).resolves.toBe('published');
  });
});
