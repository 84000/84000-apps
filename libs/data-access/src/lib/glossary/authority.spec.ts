import type { DataClient } from '../types';
import {
  authoritySearchWords,
  getGlossaryAuthorities,
  searchGlossaryAuthorities,
} from './authority';

type Row = Record<string, unknown>;
type Tables = { authorities: Row[]; names: Row[] };

const TSV: Record<string, [string, string]> = {
  content_tsv: ['names', 'content'],
  content_transformed_tsv: ['names', 'content_transformed'],
  headword_tsv: ['authorities', 'headword'],
};

/** Whether every query prefix starts a word of the text. */
const tsMatch = (text: unknown, tsquery: string) => {
  const words = authoritySearchWords(String(text ?? ''));
  return tsquery
    .split(' & ')
    .map((part) => part.replace(/:\*$/, ''))
    .every((prefix) => words.some((word) => word.startsWith(prefix)));
};

/** A client over in-memory tables, answering the queries the search makes. */
const fakeClient = (tables: Tables, fail?: string) => {
  const calls: { table: string; filter: string }[] = [];
  const client = {
    from(table: keyof Tables) {
      let rows = [...tables[table]];
      let filter = '';
      const query = {
        select: () => query,
        textSearch(column: string, tsquery: string) {
          const [, field] = TSV[column];
          filter = `${column}:${tsquery}`;
          rows = rows.filter((row) => tsMatch(row[field], tsquery));
          return query;
        },
        in(column: string, values: string[]) {
          filter = filter || `in:${column}`;
          rows = rows.filter((row) => values.includes(row[column] as string));
          return query;
        },
        order: () => query,
        limit(count: number) {
          rows = rows.slice(0, count);
          return query;
        },
        range(from: number, to: number) {
          rows = rows.slice(from, to + 1);
          return query;
        },
        then(resolve: (value: unknown) => void) {
          calls.push({ table, filter });
          resolve(
            fail && filter.startsWith(fail)
              ? { data: null, error: { message: 'boom' } }
              : { data: rows, error: null },
          );
        },
      };
      return query;
    },
  };
  return { client: client as unknown as DataClient, calls };
};

const authority = (uuid: string, headword: string, language = 'en') => ({
  uuid,
  headword,
  headword_language: language,
  definition: `<p>The ${headword}.</p>`,
});

const name = (
  uuid: string,
  authorityUuid: string,
  language: string,
  content: string,
  transformed: string | null = null,
) => ({
  uuid,
  authority_uuid: authorityUuid,
  language,
  content,
  content_transformed: transformed,
});

const TABLES: Tables = {
  authorities: [
    authority('a-long', 'Mañjuśrī the youthful prince', 'Sa-Ltn'),
    authority('a-manjusri', 'Mañjuśrī', 'Sa-Ltn'),
    authority('a-bodhicitta', 'bodhicitta', 'Sa-Ltn'),
    authority('a-other', 'Avalokiteśvara', 'Sa-Ltn'),
  ],
  names: [
    name('n1', 'a-manjusri', 'en', 'Mañjuśrī'),
    name('n2', 'a-manjusri', 'Bo-Ltn', '’jam dpal', 'འཇམ་དཔལ།'),
    name(
      'n3',
      'a-bodhicitta',
      'Bo-Ltn',
      'byang chub kyi sems',
      'བྱང་ཆུབ་ཀྱི་སེམས།',
    ),
    name('n4', 'a-bodhicitta', 'en', 'mind of awakening'),
    name('n5', 'a-other', 'en', 'Lord who looks down'),
  ],
};

describe('authoritySearchWords', () => {
  it('lowercases and drops diacritics and punctuation', () => {
    expect(authoritySearchWords('Mañjuśrī-kumāra, the Youthful')).toEqual([
      'manjusri',
      'kumara',
      'the',
      'youthful',
    ]);
  });

  it('splits Wylie on spaces and apostrophes', () => {
    expect(authoritySearchWords("byang chub sems dpa'")).toEqual([
      'byang',
      'chub',
      'sems',
      'dpa',
    ]);
  });

  it('keeps Tibetan script whole, split on tsheg and shad', () => {
    expect(authoritySearchWords('བྱང་ཆུབ་སེམས་དཔའ།')).toEqual([
      'བྱང',
      'ཆུབ',
      'སེམས',
      'དཔའ',
    ]);
  });

  it('has no words for blank or punctuation-only text', () => {
    expect(authoritySearchWords('  ')).toEqual([]);
    expect(authoritySearchWords('—,;')).toEqual([]);
  });
});

describe('searchGlossaryAuthorities', () => {
  it('returns nothing, without a request, for a blank query', async () => {
    const { client, calls } = fakeClient(TABLES);
    expect(await searchGlossaryAuthorities({ client, query: ' ' })).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('ranks the whole headword above a longer one that starts with it', async () => {
    const { client } = fakeClient(TABLES);
    const found = await searchGlossaryAuthorities({
      client,
      query: 'manjusri',
    });
    expect(found?.map((a) => a.uuid)).toEqual(['a-manjusri', 'a-long']);
    expect(found?.[0]?.matchedName).toBeNull();
  });

  it('finds an authority by a name in another language, naming the match', async () => {
    const { client } = fakeClient(TABLES);
    const found = await searchGlossaryAuthorities({
      client,
      query: 'byang chub',
    });
    expect(found?.map((a) => a.uuid)).toEqual(['a-bodhicitta']);
    expect(found?.[0]?.matchedName?.content).toBe('byang chub kyi sems');
  });

  it('searches only the Tibetan script for a query in script', async () => {
    const { client, calls } = fakeClient(TABLES);
    const found = await searchGlossaryAuthorities({
      client,
      query: 'འཇམ་དཔལ',
    });
    expect(found?.map((a) => a.uuid)).toEqual(['a-manjusri']);
    expect(found?.[0]?.matchedName?.contentTransformed).toBe('འཇམ་དཔལ།');
    const searched = calls.map((c) => c.filter.split(':')[0]);
    expect(searched).toContain('content_transformed_tsv');
    expect(searched).not.toContain('content_tsv');
  });

  it('returns each authority with its headword, definition and every name', async () => {
    const { client } = fakeClient(TABLES);
    const [hit] =
      (await searchGlossaryAuthorities({ client, query: 'mind' })) ?? [];
    expect(hit).toMatchObject({
      uuid: 'a-bodhicitta',
      headword: 'bodhicitta',
      headwordLanguage: 'Sa-Ltn',
      definition: '<p>The bodhicitta.</p>',
    });
    expect(hit?.names.map((n) => n.content)).toEqual([
      'byang chub kyi sems',
      'mind of awakening',
    ]);
  });

  it('keeps to the limit', async () => {
    const { client } = fakeClient(TABLES);
    const found = await searchGlossaryAuthorities({
      client,
      query: 'manjusri',
      limit: 1,
    });
    expect(found?.map((a) => a.uuid)).toEqual(['a-manjusri']);
  });

  it('is null when a read fails', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => null);
    const { client } = fakeClient(TABLES, 'headword_tsv');
    expect(await searchGlossaryAuthorities({ client, query: 'x' })).toBeNull();
    error.mockRestore();
  });
});

describe('getGlossaryAuthorities', () => {
  it('reads authorities in the order asked, leaving out unknown ones', async () => {
    const { client } = fakeClient(TABLES);
    const read = await getGlossaryAuthorities({
      client,
      uuids: ['a-other', 'missing', 'a-manjusri'],
    });
    expect(read?.map((a) => a.uuid)).toEqual(['a-other', 'a-manjusri']);
    expect(read?.[1]?.names.map((n) => n.language)).toEqual(['Bo-Ltn', 'en']);
  });

  it('is null when the read fails', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => null);
    const { client } = fakeClient(TABLES, 'in:uuid');
    expect(
      await getGlossaryAuthorities({ client, uuids: ['a-other'] }),
    ).toBeNull();
    error.mockRestore();
  });
});
