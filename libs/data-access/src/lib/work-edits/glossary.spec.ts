import type { GlossaryEntry, GlossaryEntryName } from '../glossary/entry/types';
import { matchGlossaryNames } from './glossary';

const E = '20000000-0000-4000-8000-000000000001';
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

  it('matches nothing for a new entry', () => {
    expect(
      rows(matchGlossaryNames(undefined, [{ language: 'en', content: 'x' }])),
    ).toEqual([undefined]);
  });
});
