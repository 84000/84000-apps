import { getGlossaryTermContexts } from './term-context';
import { getGlossaryTermPassagesPage } from './pagination';
import { DataClient } from '../types';

jest.mock('./pagination', () => ({
  getGlossaryTermPassagesPage: jest.fn(),
}));
const mocked = jest.mocked(getGlossaryTermPassagesPage);

const client = {} as DataClient;

const passage = (content: string, annotations: unknown[]) =>
  ({ uuid: 'p-1', label: '1.3', content, annotations }) as never;

describe('getGlossaryTermContexts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cuts a window around each use of this term and marks it', async () => {
    const content =
      'aaaa the Blessed One said bbbb and the Blessed One left cccc';
    mocked.mockResolvedValue({
      items: [
        passage(content, [
          { type: 'glossaryInstance', glossary: 'g-1', start: 39, end: 50 },
          { type: 'glossaryInstance', glossary: 'g-1', start: 9, end: 20 },
          { type: 'glossaryInstance', glossary: 'g-other', start: 0, end: 4 },
          { type: 'span', start: 0, end: 10 },
        ]),
      ],
      nextCursor: null,
      hasMore: false,
    });

    const result = await getGlossaryTermContexts({
      client,
      glossaryUuid: 'g-1',
      window: 5,
      source: 'draft',
    });

    expect(mocked).toHaveBeenCalledWith({
      client,
      uuid: 'g-1',
      first: 5,
      source: 'draft',
    });
    expect(result).toEqual({
      glossaryUuid: 'g-1',
      hasMore: false,
      contexts: [
        {
          passageUuid: 'p-1',
          label: '1.3',
          snippets: ['… the «Blessed One» said…', '… the «Blessed One» left…'],
        },
      ],
    });
  });

  it('falls back to the head of the passage when the read carries no annotation', async () => {
    mocked.mockResolvedValue({
      items: [passage('x'.repeat(200), [])],
      nextCursor: null,
      hasMore: true,
    });

    const result = await getGlossaryTermContexts({
      client,
      glossaryUuid: 'g-1',
      window: 50,
    });

    expect(result.hasMore).toBe(true);
    expect(result.contexts[0].snippets).toEqual(['x'.repeat(100) + '…']);
  });

  it('returns no contexts for a term with no citing passages', async () => {
    mocked.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    const result = await getGlossaryTermContexts({
      client,
      glossaryUuid: 'g-1',
    });
    expect(result.contexts).toEqual([]);
  });
});
