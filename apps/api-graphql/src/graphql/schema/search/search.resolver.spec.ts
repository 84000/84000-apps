import type { EntitySearchResult } from '@eightyfourthousand/data-access';
import type { GraphQLContext } from '../../context';
import { entitySearchResultResolvers } from './search.resolver';

const ctxWith = (load: jest.Mock) =>
  ({
    loaders: { passageLocationsByUuid: { load } },
  }) as unknown as GraphQLContext;

const hit = (type: EntitySearchResult['type']): EntitySearchResult => ({
  uuid: 'x-1',
  type,
  label: 'x',
  text: '',
});

describe('EntitySearchResult location fields', () => {
  it("resolves a passage's section type and Toh", async () => {
    const load = jest
      .fn()
      .mockResolvedValue({ type: 'endnotes', toh: 'toh871' });
    const ctx = ctxWith(load);

    await expect(
      entitySearchResultResolvers.passageType(hit('passage'), {}, ctx),
    ).resolves.toBe('endnotes');
    await expect(
      entitySearchResultResolvers.passageToh(hit('passage'), {}, ctx),
    ).resolves.toBe('toh871');
    expect(load).toHaveBeenCalledWith('x-1');
  });

  it('is null for a passage without a Toh or one not found', async () => {
    const ctx = ctxWith(
      jest
        .fn()
        .mockResolvedValueOnce({ type: 'introduction' })
        .mockResolvedValueOnce(null),
    );
    await expect(
      entitySearchResultResolvers.passageToh(hit('passage'), {}, ctx),
    ).resolves.toBeNull();
    await expect(
      entitySearchResultResolvers.passageType(hit('passage'), {}, ctx),
    ).resolves.toBeNull();
  });

  it('reads nothing for other kinds', async () => {
    const load = jest.fn();
    await expect(
      entitySearchResultResolvers.passageType(
        hit('glossary'),
        {},
        ctxWith(load),
      ),
    ).resolves.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});
