import type { DataClient } from '../../types';
import { getGlossaryEntries, getGlossaryEntry } from './read';
import type { GlossaryEntryDTO } from './types';

const W = '10000000-0000-4000-8000-000000000001';
const E1 = '20000000-0000-4000-8000-000000000001';

const DTO: GlossaryEntryDTO = {
  uuid: E1,
  work_uuid: W,
  authority_uuid: 'a1',
  definition: 'A definition.',
  definition_rend: 'appendWithStandard',
  gloss_mode: 'marked',
  names: [
    {
      glossary_uuid: E1,
      name_uuid: 'n1',
      name_authority_uuid: 'a2',
      language: 'Bo-Ltn',
      content: 'sems',
      content_transformed: 'སེམས',
      term_type: 'translationMain',
      attestation: 'attestedDictionary',
    },
  ],
};

const clientAnswering = (answer: () => unknown) => {
  const rpc = jest.fn(async () => answer());
  return { client: { rpc } as unknown as DataClient, rpc };
};

describe('getGlossaryEntry', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps a found entry, and tells a missing entry apart from a failed read', async () => {
    const found = clientAnswering(() => ({ data: [DTO], error: null }));
    expect(
      await getGlossaryEntry({ client: found.client, workUuid: W, uuid: E1 }),
    ).toEqual({
      status: 'found',
      entry: {
        uuid: E1,
        workUuid: W,
        authorityUuid: 'a1',
        definition: 'A definition.',
        definitionRend: 'appendWithStandard',
        glossMode: 'marked',
        names: [
          {
            glossaryUuid: E1,
            nameUuid: 'n1',
            nameAuthorityUuid: 'a2',
            language: 'Bo-Ltn',
            content: 'sems',
            contentTransformed: 'སེམས',
            termType: 'translationMain',
            attestation: 'attestedDictionary',
          },
        ],
      },
    });
    expect(found.rpc).toHaveBeenCalledWith('read_glossary_entries', {
      p_work_uuid: W,
      p_uuids: [E1],
    });

    const missing = clientAnswering(() => ({ data: [], error: null }));
    expect(
      await getGlossaryEntry({ client: missing.client, workUuid: W, uuid: E1 }),
    ).toEqual({ status: 'not-found' });

    const refused = clientAnswering(() => ({
      data: null,
      error: { message: 'denied' },
    }));
    expect(
      await getGlossaryEntry({ client: refused.client, workUuid: W, uuid: E1 }),
    ).toEqual({ status: 'failed', error: 'denied' });

    const thrown = clientAnswering(() => {
      throw new Error('socket hang up');
    });
    expect(
      await getGlossaryEntry({ client: thrown.client, workUuid: W, uuid: E1 }),
    ).toEqual({ status: 'failed', error: 'socket hang up' });
  });

  it('getGlossaryEntries reads nothing for no uuids, and is null when the read fails', async () => {
    const unused = clientAnswering(() => ({ data: [DTO], error: null }));
    expect(
      await getGlossaryEntries({
        client: unused.client,
        workUuid: W,
        uuids: [],
      }),
    ).toEqual([]);
    expect(unused.rpc).not.toHaveBeenCalled();

    const refused = clientAnswering(() => ({
      data: null,
      error: { message: 'denied' },
    }));
    expect(
      await getGlossaryEntries({
        client: refused.client,
        workUuid: W,
        uuids: [E1],
      }),
    ).toBeNull();
  });
});
