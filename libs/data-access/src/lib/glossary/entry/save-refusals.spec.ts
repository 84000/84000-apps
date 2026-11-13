/**
 * @jest-environment node
 */
// Each input refusal is pinned exactly (reason, field, message), and must not
// touch the database: the client throws on any use.
import type { DataClient } from '../../types';
import { saveGlossaryEntries } from './save';
import type {
  GlossaryEntryDelete,
  GlossaryEntryNameInput,
  GlossaryEntrySave,
  GlossaryNewAuthority,
} from './types';

const E1 = '11111111-1111-4111-8111-111111111111';
const E2 = '22222222-2222-4222-8222-222222222222';
const A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const A2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const R1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

/** A client any use of which fails the test. */
const untouchable = new Proxy(
  {},
  {
    get(_, prop) {
      if (prop === 'then') return undefined;
      throw new Error(`the client was used (${String(prop)})`);
    },
  },
) as DataClient;

const en = (
  content: string,
  o: Partial<GlossaryEntryNameInput> = {},
): GlossaryEntryNameInput => ({
  language: 'en',
  content,
  contentTransformed: null,
  termType: null,
  attestation: null,
  ...o,
});

const create = (
  change: GlossaryEntrySave['change'],
  o: Partial<GlossaryEntrySave> = {},
): GlossaryEntrySave => ({ uuid: E1, create: true, change, ...o });

const authority = (
  o: Partial<GlossaryNewAuthority> = {},
): GlossaryNewAuthority => ({
  uuid: A2,
  headword: 'Indra',
  headwordLanguage: 'Sa-Ltn',
  ...o,
});

type Case = {
  name: string;
  saves?: GlossaryEntrySave[];
  deletes?: GlossaryEntryDelete[];
  authorities?: GlossaryNewAuthority[];
  field: string;
  error: string;
};

const CASES: Case[] = [
  {
    name: 'a malformed entry uuid',
    saves: [{ uuid: 'nope', change: {} }],
    field: 'uuid',
    error: 'nope is not a uuid',
  },
  {
    name: 'a malformed delete uuid',
    deletes: [{ uuid: 'nope' }],
    field: 'uuid',
    error: 'nope is not a uuid',
  },
  {
    name: 'an entry saved and deleted',
    saves: [{ uuid: E1, change: {} }],
    deletes: [{ uuid: E1 }],
    field: 'uuid',
    error: `Entry ${E1} is saved or deleted twice`,
  },
  {
    name: 'a malformed new authority uuid',
    saves: [create({ authorityUuid: A2, names: [en('x')] })],
    authorities: [authority({ uuid: 'bad' })],
    field: 'authorities[0].uuid',
    error: 'bad is not a uuid',
  },
  {
    name: 'a new authority given twice',
    saves: [create({ authorityUuid: A2, names: [en('x')] })],
    authorities: [authority(), authority()],
    field: 'authorities[1].uuid',
    error: `Authority ${A2} is created twice`,
  },
  {
    name: 'a new authority with a blank headword',
    saves: [create({ authorityUuid: A2, names: [en('x')] })],
    authorities: [authority({ headword: '  ' })],
    field: 'authorities[0].headword',
    error: 'A new authority needs a headword',
  },
  {
    name: 'a new authority without a headword language',
    saves: [create({ authorityUuid: A2, names: [en('x')] })],
    authorities: [authority({ headwordLanguage: '' })],
    field: 'authorities[0].headwordLanguage',
    error: 'A new authority needs the language of its headword',
  },
  {
    name: 'a malformed name row uuid',
    saves: [{ uuid: E1, change: { names: [en('x', { glossaryUuid: 'g' })] } }],
    field: 'names[0].glossaryUuid',
    error: 'g is not a uuid',
  },
  {
    name: 'a malformed names row uuid',
    saves: [{ uuid: E1, change: { names: [en('x', { nameUuid: 'n' })] } }],
    field: 'names[0].nameUuid',
    error: 'n is not a uuid',
  },
  {
    name: 'a row listed twice in one entry',
    saves: [
      {
        uuid: E1,
        change: {
          names: [en('x', { glossaryUuid: R1 }), en('y', { glossaryUuid: R1 })],
        },
      },
    ],
    field: 'names[1].glossaryUuid',
    error: `Row ${R1} is listed twice`,
  },
  {
    name: 'a row in two entries',
    saves: [
      { uuid: E1, change: { names: [en('x', { glossaryUuid: R1 })] } },
      { uuid: E2, change: { names: [en('y', { glossaryUuid: R1 })] } },
    ],
    field: 'names[0].glossaryUuid',
    error: `Row ${R1} is in two entries`,
  },
  {
    name: "another entry's root row",
    saves: [
      { uuid: E1, change: { names: [en('x', { glossaryUuid: E2 })] } },
      { uuid: E2, change: {} },
    ],
    field: 'names[0].glossaryUuid',
    error: `Row ${E2} is in two entries`,
  },
  {
    name: 'a malformed authority on an update',
    saves: [{ uuid: E1, change: { authorityUuid: 'x' } }],
    field: 'authorityUuid',
    error: 'x is not a uuid',
  },
  {
    name: 'a new name on an update without a language',
    saves: [{ uuid: E1, change: { names: [en('x', { language: '' })] } }],
    field: 'names[0].language',
    error: 'A name needs a language',
  },
  {
    name: 'a create with an expect',
    saves: [
      create(
        { authorityUuid: A1, names: [en('x')] },
        { expect: { definition: null } },
      ),
    ],
    field: 'expect',
    error: 'A create has nothing to expect',
  },
  {
    name: 'a create without an authority',
    saves: [create({ names: [en('x')] })],
    field: 'authorityUuid',
    error: 'A new entry needs an authority',
  },
  {
    name: 'a create with a malformed authority',
    saves: [create({ authorityUuid: 'x', names: [en('x')] })],
    field: 'authorityUuid',
    error: 'A new entry needs an authority',
  },
  {
    name: 'a create without names',
    saves: [create({ authorityUuid: A1, names: [] })],
    field: 'names',
    error: 'A new entry needs at least one name',
  },
  {
    name: 'a create whose first name is another row',
    saves: [
      create({ authorityUuid: A1, names: [en('x', { glossaryUuid: R1 })] }),
    ],
    field: 'names[0].glossaryUuid',
    error: "The first name's row is the entry",
  },
  {
    name: 'a create with an unknown definition rend',
    saves: [
      create({
        authorityUuid: A1,
        definitionRend: 'sideways',
        names: [en('x')],
      }),
    ],
    field: 'definitionRend',
    error: 'Unknown definition rend sideways',
  },
  {
    name: 'a create with an unknown matching mode',
    saves: [
      create({ authorityUuid: A1, glossMode: 'fuzzy', names: [en('x')] }),
    ],
    field: 'glossMode',
    error: 'Unknown matching mode fuzzy',
  },
  {
    name: 'a create with a name without text',
    saves: [create({ authorityUuid: A1, names: [en('x'), en('')] })],
    field: 'names[1].content',
    error: 'A name needs its text',
  },
  {
    name: 'a create with a Tibetan name without script',
    saves: [
      create({
        authorityUuid: A1,
        names: [en('x'), en('brgya byin', { language: 'Bo-Ltn' })],
      }),
    ],
    field: 'names[1].contentTransformed',
    error: 'A Tibetan name needs its Tibetan script',
  },
  {
    name: 'a create with an unknown term type',
    saves: [
      create({ authorityUuid: A1, names: [en('x', { termType: 'main' })] }),
    ],
    field: 'names[0].termType',
    error: 'Unknown term type main',
  },
  {
    name: 'a create with an unknown attestation',
    saves: [
      create({
        authorityUuid: A1,
        names: [en('x', { attestation: 'attestedNowhere' })],
      }),
    ],
    field: 'names[0].attestation',
    error: 'Unknown attestation attestedNowhere',
  },
];

describe('saveGlossaryEntries input refusals', () => {
  it.each(CASES)(
    'refuses $name as invalid, before reading anything',
    async ({ saves = [], deletes, authorities, field, error }) => {
      const result = await saveGlossaryEntries({
        client: untouchable,
        workUuid: '99999999-9999-4999-8999-999999999999',
        saves,
        deletes,
        authorities,
      });
      expect(result).toEqual({
        success: false,
        reason: 'invalid',
        error,
        field,
        outcomeUnknown: false,
      });
    },
  );

  it('accepts an empty call as a success that writes nothing, on a dry run too', async () => {
    for (const dryRun of [false, true]) {
      expect(
        await saveGlossaryEntries({
          client: untouchable,
          workUuid: '99999999-9999-4999-8999-999999999999',
          saves: [],
          dryRun,
        }),
      ).toEqual({
        success: true,
        dryRun,
        entries: [],
        deleted: [],
        changes: {
          glossaries: { inserted: 0, updated: 0, deleted: 0 },
          glossaryEdges: { inserted: 0, deleted: 0 },
          names: { inserted: 0, updated: 0 },
          annotations: { deleted: 0 },
        },
      });
    }
  });
});
