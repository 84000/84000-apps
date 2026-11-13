import type { Comment, GlossaryEntry } from '@eightyfourthousand/data-access';
import type { GraphQLContext } from '../../context';
import { workGlossaryCommentsResolver } from './comment.resolver';

const mockEntries = jest.fn();
const mockScope = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getGlossaryCommentEntries: (args: unknown) => mockEntries(args),
  getCommentsByEntityUuids: (args: unknown) => mockScope(args),
}));

const entry = (uuid: string, english?: string) =>
  ({
    uuid,
    names: english
      ? [{ language: 'en', content: english, termType: 'translationMain' }]
      : [],
  }) as GlossaryEntry;

const thread = (uuid: string) => ({ uuid }) as Comment;

const ctx = (source: 'draft' | 'published' = 'draft') =>
  ({ supabase: {}, source }) as unknown as GraphQLContext;

const resolve = (source?: 'draft' | 'published') =>
  workGlossaryCommentsResolver({ uuid: 'w1' }, {}, ctx(source));

beforeEach(() => jest.clearAllMocks());

describe('workGlossaryCommentsResolver', () => {
  it("lists each entry's threads under its English name", async () => {
    mockEntries.mockResolvedValue([entry('g1', 'Indra'), entry('g2')]);
    mockScope.mockResolvedValue(
      new Map([
        ['g1', [thread('t1')]],
        ['g2', [thread('t2'), thread('t3')]],
      ]),
    );

    await expect(resolve()).resolves.toEqual([
      { uuid: 'g1', label: 'Indra', comments: [thread('t1')] },
      { uuid: 'g2', label: null, comments: [thread('t2'), thread('t3')] },
    ]);
    expect(mockEntries).toHaveBeenCalledWith(
      expect.objectContaining({ workUuid: 'w1' }),
    );
    expect(mockScope).toHaveBeenCalledWith(
      expect.objectContaining({
        entityUuids: ['g1', 'g2'],
        entityType: 'glossary',
      }),
    );
  });

  it('leaves out an entry whose threads are gone', async () => {
    mockEntries.mockResolvedValue([entry('g1', 'Indra')]);
    mockScope.mockResolvedValue(new Map());

    await expect(resolve()).resolves.toEqual([]);
  });

  it('reads nothing for a published version or a work with none', async () => {
    await expect(resolve('published')).resolves.toEqual([]);
    expect(mockEntries).not.toHaveBeenCalled();

    mockEntries.mockResolvedValue([]);
    await expect(resolve()).resolves.toEqual([]);
    expect(mockScope).not.toHaveBeenCalled();
  });

  it('is empty when the entries cannot be read', async () => {
    mockEntries.mockResolvedValue(null);

    await expect(resolve()).resolves.toEqual([]);
    expect(mockScope).not.toHaveBeenCalled();
  });
});
