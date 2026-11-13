import { NO_CHANGES, saveGlossaryEntries } from '../glossary/entry/save';
import { readEntries } from '../glossary/entry/stored';
import type {
  GlossaryEntry,
  GlossaryEntryName,
  GlossarySaveResult,
} from '../glossary/entry/types';
import type { DataClient } from '../types';
import { planGlossary } from './glossary';
import { matchGlossaryNames } from './glossary-names';
import type { GlossaryOp } from './types';

jest.mock('../glossary/entry/stored', () => ({
  ...jest.requireActual('../glossary/entry/stored'),
  readEntries: jest.fn(),
}));
jest.mock('../glossary/entry/save', () => ({
  ...jest.requireActual('../glossary/entry/save'),
  saveGlossaryEntries: jest.fn(),
}));

const W = '10000000-0000-4000-8000-000000000001';
const E = '20000000-0000-4000-8000-000000000001';
const A = '30000000-0000-4000-8000-000000000001';
const B = '30000000-0000-4000-8000-000000000002';
const r = (i: number) => `40000000-0000-4000-8000-00000000000${i}`;

const name = (
  glossaryUuid: string,
  language: string,
  content: string,
  o: Partial<GlossaryEntryName> = {},
): GlossaryEntryName => ({
  glossaryUuid,
  nameUuid: `n-${glossaryUuid}`,
  nameAuthorityUuid: 'a',
  language,
  content,
  contentTransformed: null,
  termType: null,
  attestation: null,
  ...o,
});

const entry: GlossaryEntry = {
  uuid: E,
  workUuid: 'w',
  authorityUuid: 'a',
  definition: null,
  definitionRend: null,
  glossMode: 'match',
  names: [
    name(E, 'en', 'mind', { termType: 'translationMain' }),
    name(r(1), 'Bo-Ltn', 'sems', {
      contentTransformed: 'སེམས',
      attestation: 'attestedSource',
    }),
    name(r(2), 'en', 'thought'),
    name(r(3), 'Sa-Ltn', 'citta'),
  ],
};

const rows = (list: ReturnType<typeof matchGlossaryNames>) =>
  list.map((n) => n.glossaryUuid);

describe('matchGlossaryNames', () => {
  it('matches the first name to the root, then by language and content, then by language', () => {
    const list = matchGlossaryNames(entry, [
      { language: 'en', content: 'heart' },
      { language: 'Sa-Ltn', content: 'cetas' },
      { language: 'en', content: 'thought' },
      { language: 'Bo-Ltn', content: 'sems' },
    ]);
    expect(rows(list)).toEqual([E, r(3), r(2), r(1)]);
  });

  it('keeps the stored values a matched name omits, and lets null clear them', () => {
    const [root, bo] = matchGlossaryNames(entry, [
      { language: 'en', content: 'mind' },
      { language: 'Bo-Ltn', content: 'sems', attestation: null },
    ]);
    expect(root).toMatchObject({ termType: 'translationMain' });
    expect(bo).toMatchObject({
      glossaryUuid: r(1),
      contentTransformed: 'སེམས',
      attestation: null,
    });
  });

  it('leaves unmatched names new, and honours a given row', () => {
    const list = matchGlossaryNames(entry, [
      { language: 'en', content: 'mind' },
      { glossaryUuid: r(3), language: 'Sa-Ltn', content: 'manas' },
      { language: 'zh', content: '心' },
      { language: 'Sa-Ltn', content: 'citta' },
    ]);
    expect(rows(list)).toEqual([E, r(3), undefined, undefined]);
    expect(list[2]).toMatchObject({
      contentTransformed: null,
      termType: null,
      attestation: null,
    });
  });

  it('drops the stored Tibetan script when the text changes', () => {
    const [, bo] = matchGlossaryNames(entry, [
      { language: 'en', content: 'mind' },
      { language: 'Bo-Ltn', content: 'sems pa' },
    ]);
    expect(bo).toMatchObject({ glossaryUuid: r(1), contentTransformed: null });
  });

  it('matches nothing for a new entry', () => {
    expect(
      rows(matchGlossaryNames(undefined, [{ language: 'en', content: 'x' }])),
    ).toEqual([undefined]);
  });
});

describe('planGlossary', () => {
  const read = jest.mocked(readEntries);
  const save = jest.mocked(saveGlossaryEntries);
  const client = {} as DataClient;
  const stored: GlossaryEntry = { ...entry, workUuid: W, authorityUuid: A };
  const ok: GlossarySaveResult = {
    success: true,
    dryRun: true,
    entries: [],
    deleted: [],
    changes: NO_CHANGES,
  };

  beforeEach(() => {
    read.mockReset().mockResolvedValue({ ok: true, entries: [stored] });
    save.mockReset().mockResolvedValue(ok);
  });

  const plan = (...ops: GlossaryOp[]) =>
    planGlossary({ client, workUuid: W, ops });
  const savedArgs = () => save.mock.calls[0][0];
  const errorOf = (result: Awaited<ReturnType<typeof plan>>) =>
    result.ok ? undefined : result.error;

  it('refuses a patch whose set key has no expect value, before any read', async () => {
    const result = await plan({
      op: 'patch-glossary-entry',
      uuid: E,
      set: { definition: '<p>new</p>' },
      expect: { glossMode: 'match' },
    });
    expect(result).toMatchObject({ ok: false });
    expect(errorOf(result)).toMatch(/sets definition without an expect value/);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses a stale expect, naming the field and both values', async () => {
    const result = await plan({
      op: 'patch-glossary-entry',
      uuid: E,
      set: { definition: '<p>new</p>' },
      expect: { definition: '<p>old</p>' },
    });
    expect(errorOf(result)).toMatch(
      /^Nothing was saved: .*expected definition to be "<p>old<\/p>" but found null/,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('reads an unset glossMode expectation as match', async () => {
    const result = await plan({
      op: 'patch-glossary-entry',
      uuid: E,
      set: { glossMode: 'marked' },
      expect: { glossMode: null },
    });
    expect(result.ok).toBe(true);
  });

  it('refuses an entry named by two ops', async () => {
    const result = await plan(
      { op: 'delete-glossary-entry', uuid: E },
      {
        op: 'relink-glossary-entry',
        uuid: E,
        authority: B,
        expect: { authority: A },
      },
    );
    expect(errorOf(result)).toMatch(/named by more than one glossary op/);
    expect(read).not.toHaveBeenCalled();
  });

  it('carries every expect key into the save, not only the changed ones', async () => {
    await plan({
      op: 'patch-glossary-entry',
      uuid: E,
      set: { definition: '<p>new</p>' },
      expect: {
        definition: null,
        authority: A,
        names: stored.names.map(({ language, content }) => ({
          language: language as string,
          content,
        })),
      },
    });
    expect(savedArgs().saves).toEqual([
      {
        uuid: E,
        change: { definition: '<p>new</p>' },
        expect: { definition: null, authorityUuid: A, names: stored.names },
      },
    ]);
  });

  it('compares definitions as they will be stored', async () => {
    read.mockResolvedValue({
      ok: true,
      entries: [{ ...stored, definition: '<p>a &amp; b</p>' }],
    });
    const result = await plan({
      op: 'patch-glossary-entry',
      uuid: E,
      set: { definition: '<p>a & b</p>' },
      expect: { definition: '<p>a & b</p>' },
    });
    expect(result.ok).toBe(true);
    expect(result.changes.entries[0].action).toBe('unchanged');
  });

  it('accepts a definition expect copied verbatim from a non-canonical stored one', async () => {
    const raw = '<p>Old<!-- kept --></p>';
    read.mockResolvedValue({
      ok: true,
      entries: [{ ...stored, definition: raw }],
    });
    const result = await plan({
      op: 'delete-glossary-entry',
      uuid: E,
      expect: { definition: raw },
    });
    expect(result.ok).toBe(true);
  });

  it('keeps a non-canonical stored definition sent back verbatim, and matches its sanitized form', async () => {
    const raw = '<p>Old<!-- kept --></p>';
    read.mockResolvedValue({
      ok: true,
      entries: [{ ...stored, definition: raw }],
    });
    const result = await plan({
      op: 'patch-glossary-entry',
      uuid: E,
      set: { definition: raw },
      expect: { definition: '<p>Old</p>' },
    });
    expect(result.ok).toBe(true);
    expect(result.changes.entries[0].action).toBe('unchanged');
  });

  it('matches expected names one to one in any order', async () => {
    const twin = name(r(4), 'en', 'mind', { termType: 'translationMain' });
    const plain = name(r(5), 'en', 'mind');
    read.mockResolvedValue({
      ok: true,
      entries: [{ ...stored, names: [twin, plain] }],
    });
    const names = [
      { language: 'en', content: 'mind' },
      { language: 'en', content: 'mind', termType: 'translationMain' as const },
    ];
    const result = await plan({
      op: 'delete-glossary-entry',
      uuid: E,
      expect: { names },
    });
    expect(result.ok).toBe(true);
  });

  it('refuses a relink without expect rather than throwing', async () => {
    const result = await plan({
      op: 'relink-glossary-entry',
      uuid: E,
      authority: B,
    } as unknown as GlossaryOp);
    expect(errorOf(result)).toMatch(/needs expect\.authority/);
    expect(save).not.toHaveBeenCalled();
  });

  it('reads uuids given in uppercase as the stored ones', async () => {
    const ex = 'abcdef00-0000-4000-8000-00000000000a';
    const ax = 'abcdef00-0000-4000-8000-00000000000b';
    const bx = 'abcdef00-0000-4000-8000-00000000000c';
    read.mockResolvedValue({
      ok: true,
      entries: [{ ...stored, uuid: ex, authorityUuid: ax }],
    });
    const result = await plan({
      op: 'relink-glossary-entry',
      uuid: ex.toUpperCase(),
      authority: bx.toUpperCase(),
      expect: { authority: ax.toUpperCase() },
    });
    expect(result.ok).toBe(true);
    expect(read.mock.calls[0][2]).toEqual([ex]);
    expect(savedArgs().saves[0]).toMatchObject({
      uuid: ex,
      change: { authorityUuid: bx },
    });
  });

  it('derives the same entry and authority uuids on a re-run', async () => {
    read.mockResolvedValue({ ok: true, entries: [] });
    const op: GlossaryOp = {
      op: 'upsert-glossary-entry',
      entry: {
        authority: { new: { headword: 'citta', headwordLanguage: 'Sa-Ltn' } },
        names: [{ language: 'en', content: 'mind' }],
      },
    };
    await plan(op);
    await plan(op);
    const [first, second] = save.mock.calls.map(([args]) => args);
    expect(first.saves[0].uuid).toBe(second.saves[0].uuid);
    expect(first.authorities).toEqual(second.authorities);
    expect(first.saves[0].change.authorityUuid).toBe(
      first.authorities?.[0].uuid,
    );
  });

  it('reports each entry its own copied and moved names rows, and a delete with no after', async () => {
    const F = '20000000-0000-4000-8000-000000000002';
    const G = '20000000-0000-4000-8000-000000000003';
    const other: GlossaryEntry = { ...stored, uuid: F, names: [] };
    const third: GlossaryEntry = { ...stored, uuid: G, names: [] };
    read.mockResolvedValue({ ok: true, entries: [stored, other, third] });
    const row = (
      entryUuid: string,
      nameUuid: string,
      action: 'copied' | 'moved',
    ) => ({ entryUuid, nameUuid, language: 'en', content: nameUuid, action });
    save.mockResolvedValue({
      ...ok,
      // The deleted entry is listed too, so only the delete branch nulls it.
      entries: [
        { ...stored, authorityUuid: B },
        other,
        { ...third, authorityUuid: B },
      ],
      deleted: [F],
      nameRows: [
        row(E, 'n-moved', 'moved'),
        row(E, 'n-copied', 'copied'),
        row(G, 'n-other', 'copied'),
      ],
    });
    const result = await plan(
      {
        op: 'relink-glossary-entry',
        uuid: E,
        authority: B,
        expect: { authority: A },
      },
      { op: 'delete-glossary-entry', uuid: F },
      {
        op: 'relink-glossary-entry',
        uuid: G,
        authority: B,
        expect: { authority: A },
      },
    );
    const [relinked, deleted, relinkedThird] = result.changes.entries;
    const text = (nameUuid: string) => ({
      nameUuid,
      language: 'en',
      content: nameUuid,
    });
    expect(relinked).toMatchObject({
      action: 'update',
      after: { authorityUuid: B },
      movedNames: [text('n-moved')],
      copiedNames: [text('n-copied')],
    });
    expect(deleted).toMatchObject({
      action: 'delete',
      before: other,
      after: null,
      movedNames: [],
      copiedNames: [],
    });
    expect(relinkedThird).toMatchObject({
      action: 'update',
      after: { uuid: G, authorityUuid: B },
      movedNames: [],
      copiedNames: [text('n-other')],
    });
  });

  it('refuses one new authority given twice with different values', async () => {
    read.mockResolvedValue({ ok: true, entries: [] });
    const U = '60000000-0000-4000-8000-000000000001';
    const upsert = (content: string, headword: string): GlossaryOp => ({
      op: 'upsert-glossary-entry',
      entry: {
        authority: {
          new: { uuid: U, headword, headwordLanguage: 'Sa-Ltn' },
        },
        names: [{ language: 'en', content }],
      },
    });
    const result = await plan(upsert('one', 'a'), upsert('two', 'b'));
    expect(errorOf(result)).toMatch(/given twice with different values/);
    expect(save).not.toHaveBeenCalled();
  });
});
