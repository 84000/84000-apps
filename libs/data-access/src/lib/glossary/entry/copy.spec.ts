import type { DataClient } from '../../types';
import { glossaryCopyOf, searchGlossaryEntriesToCopy } from './copy';
import type { GlossaryEntry, GlossaryEntryDTO } from './types';

const HERE = '10000000-0000-4000-8000-000000000001';
const THERE = '10000000-0000-4000-8000-000000000002';

const SOURCE: GlossaryEntry = {
  uuid: 'e1',
  workUuid: THERE,
  authorityUuid: 'a1',
  definition: '<p>Defined.</p>',
  definitionRend: 'prependWithStandard',
  glossMode: 'marked',
  names: [
    {
      glossaryUuid: 'e1',
      nameUuid: 'n1',
      nameAuthorityUuid: 'a1',
      language: 'en',
      content: 'Lotus',
      contentTransformed: null,
      termType: 'translationMain',
      attestation: null,
    },
    {
      glossaryUuid: 'r2',
      nameUuid: 'n2',
      nameAuthorityUuid: 'a1',
      language: 'Bo-Ltn',
      content: 'pad+ma',
      contentTransformed: 'པདྨ',
      termType: null,
      attestation: 'attestedSource',
    },
    {
      glossaryUuid: 'r3',
      nameUuid: 'n3',
      nameAuthorityUuid: 'a9',
      language: 'Sa-Ltn',
      content: 'padma',
      contentTransformed: null,
      termType: null,
      attestation: 'attestedDictionary',
    },
  ],
};

describe('glossaryCopyOf', () => {
  it("carries the source's authority, definition, rend, mode and names", () => {
    expect(glossaryCopyOf(SOURCE)).toEqual({
      authorityUuid: 'a1',
      definition: '<p>Defined.</p>',
      definitionRend: 'prependWithStandard',
      glossMode: 'marked',
      names: [
        {
          nameUuid: 'n1',
          language: 'en',
          content: 'Lotus',
          contentTransformed: null,
          termType: 'translationMain',
          attestation: null,
        },
        {
          nameUuid: 'n2',
          language: 'Bo-Ltn',
          content: 'pad+ma',
          contentTransformed: 'པདྨ',
          termType: null,
          attestation: 'attestedSource',
        },
        // Owned by another authority: written anew, with the same text.
        {
          language: 'Sa-Ltn',
          content: 'padma',
          contentTransformed: null,
          termType: null,
          attestation: 'attestedDictionary',
        },
      ],
    });
  });

  it('never names the rows of the source', () => {
    const names = glossaryCopyOf(SOURCE).names;
    expect(names.some((name) => 'glossaryUuid' in name)).toBe(false);
  });
});

describe('searchGlossaryEntriesToCopy', () => {
  const dto = (uuid: string, workUuid: string): GlossaryEntryDTO => ({
    uuid,
    work_uuid: workUuid,
    authority_uuid: 'a1',
    definition: null,
    definition_rend: null,
    gloss_mode: 'match',
    names: [],
  });

  const clientWith = (hits: unknown[]) => {
    const rpc = jest.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === 'search_entities') return { data: hits, error: null };
      const uuids = args['p_uuids'] as string[];
      return {
        data: uuids.map((u) => dto(u, args['p_work_uuid'] as string)),
        error: null,
      };
    });
    const authorities = {
      select: () => authorities,
      in: async () => ({
        data: [{ uuid: 'a1', headword: 'padma', headword_language: 'Sa-Ltn' }],
        error: null,
      }),
    };
    return {
      client: { rpc, from: () => authorities } as unknown as DataClient,
      rpc,
    };
  };

  const hit = (uuid: string, workUuid: string, label: string) => ({
    uuid,
    type: 'glossary',
    label,
    text: 'Lotus',
    work_uuid: workUuid,
    toh: 'toh8',
    work_title: 'A Work',
  });

  it('searches draft glossaries library-wide and leaves out this work', async () => {
    const { client, rpc } = clientWith([
      hit('h1', HERE, 'g.3'),
      hit('e2', THERE, 'g.7'),
    ]);

    const found = await searchGlossaryEntriesToCopy({
      client,
      workUuid: HERE,
      query: 'lotus',
    });

    expect(rpc).toHaveBeenCalledWith('search_entities', {
      p_query: 'lotus',
      p_work_uuid: null,
      p_toh: null,
      p_types: ['glossary'],
      p_limit: 50,
    });
    expect(rpc).toHaveBeenCalledWith('read_glossary_entries', {
      p_work_uuid: THERE,
      p_uuids: ['e2'],
    });
    expect(found).toEqual([
      {
        entry: expect.objectContaining({ uuid: 'e2', workUuid: THERE }),
        label: 'g.7',
        work: { uuid: THERE, toh: 'toh8', title: 'A Work' },
        headword: 'padma',
        headwordLanguage: 'Sa-Ltn',
      },
    ]);
  });

  it('finds nothing without asking for entries when every hit is here', async () => {
    const { client, rpc } = clientWith([hit('h1', HERE, 'g.3')]);

    expect(
      await searchGlossaryEntriesToCopy({ client, workUuid: HERE, query: 'x' }),
    ).toEqual([]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
