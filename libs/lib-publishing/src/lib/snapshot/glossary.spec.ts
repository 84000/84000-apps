import {
  assembleGlossaryTerms,
  formatAttestation,
  glossaryTermOf,
  termDefinition,
  type AuthorityRow,
  type GlossaryEdgeRow,
  type GlossaryRow,
  type NameRow,
} from './glossary';

const WORK = 'work-1';

const glossary = (
  uuid: string,
  overrides: Partial<GlossaryRow> = {},
): GlossaryRow => ({
  uuid,
  work_uuid: WORK,
  authority_uuid: `auth-${uuid}`,
  name_uuid: `name-${uuid}`,
  definition: null,
  definition_rend: null,
  termType: null,
  attestation: null,
  ...overrides,
});

const name = (
  uuid: string,
  content: string,
  language: string,
  transformed: string | null = null,
): NameRow => ({ uuid, content, language, content_transformed: transformed });

const authority = (
  uuid: string,
  headword: string,
  definition: string | null = null,
): AuthorityRow => ({
  uuid,
  headword,
  headword_language: 'Sa-Ltn',
  definition,
});

const self = (uuid: string): GlossaryEdgeRow => ({
  parent_uuid: uuid,
  child_uuid: uuid,
});

describe('assembleGlossaryTerms', () => {
  const rows = () => {
    const glossaries = [
      glossary('t1', { termType: 'translationMain' }),
      glossary('t1-bo', { authority_uuid: 'auth-t1' }),
      glossary('t1-sa', {
        authority_uuid: 'auth-t1',
        attestation: 'sourceUnspecified',
      }),
      glossary('t1-sa2', {
        authority_uuid: 'auth-t1',
        attestation: 'reconstructedSemantic',
      }),
      glossary('t1-alt', {
        authority_uuid: 'auth-t1',
        termType: 'translationAlternative',
      }),
      glossary('t2'),
      glossary('orphan'),
      glossary('elsewhere', { work_uuid: 'work-2' }),
    ];
    const edges = [
      self('t1'),
      { parent_uuid: 't1', child_uuid: 't1-bo' },
      { parent_uuid: 't1', child_uuid: 't1-sa' },
      { parent_uuid: 't1', child_uuid: 't1-sa2' },
      { parent_uuid: 't1', child_uuid: 't1-alt' },
      self('t2'),
      self('elsewhere'),
    ];
    const names = [
      name('name-t1', 'Blessed One', 'en'),
      name('name-t1-bo', 'bcom ldan ’das', 'Bo-Ltn', 'བཅོམ་ལྡན་འདས།'),
      name('name-t1-sa', 'bhagavat', 'Sa-Ltn'),
      name('name-t1-sa2', 'bhagavān', 'Sa-Ltn'),
      name('name-t1-alt', 'Lord', 'en'),
      name('name-t2', '’absence', 'en'),
      name('name-orphan', 'orphan', 'en'),
      name('name-elsewhere', 'elsewhere', 'en'),
    ];
    const authorities = [
      authority('auth-t1', 'bhagavat'),
      authority('auth-t2', 'abhāva'),
      authority('auth-orphan', 'x'),
      authority('auth-elsewhere', 'y'),
    ];
    return { workUuid: WORK, glossaries, edges, names, authorities };
  };

  it('keeps only this work’s glossary rows that carry a self-edge', () => {
    const terms = assembleGlossaryTerms(rows());
    expect(terms.map((t) => t.glossary_uuid).sort()).toEqual(['t1', 't2']);
  });

  it('collects names by language from the term’s children', () => {
    const t1 = assembleGlossaryTerms(rows()).find(
      (t) => t.glossary_uuid === 't1',
    );
    expect(t1).toMatchObject({
      english: 'Blessed One',
      headword: 'bhagavat',
      wylie: 'bcom ldan ’das',
      tibetan: 'བཅོམ་ལྡན་འདས།',
      sanskrit_plain: 'bhagavān, bhagavat',
      sanskrit_attested:
        '*bhagavān (Reconstructed Semantic), bhagavat (Source Unspecified)',
      alternatives: 'Lord',
      pali: null,
      chinese: null,
    });
  });

  it('numbers terms by English, ignoring punctuation as the database collation does', () => {
    const terms = assembleGlossaryTerms(rows());
    expect(terms.map((t) => [t.english, t.term_number])).toEqual([
      ['’absence', 1],
      ['Blessed One', 2],
    ]);
  });

  it('drops a term whose name or authority is missing', () => {
    const input = rows();
    input.names = input.names.filter((n) => n.uuid !== 'name-t2');
    expect(assembleGlossaryTerms(input).map((t) => t.glossary_uuid)).toEqual([
      't1',
    ]);
  });
});

describe('glossaryTermOf', () => {
  it('maps terms to themselves and child names to their term', () => {
    const edges = [self('t1'), { parent_uuid: 't1', child_uuid: 't1-bo' }];
    const terms = assembleGlossaryTerms({
      workUuid: WORK,
      glossaries: [
        glossary('t1'),
        glossary('t1-bo', { authority_uuid: 'auth-t1' }),
      ],
      edges,
      names: [
        name('name-t1', 'One', 'en'),
        name('name-t1-bo', 'gcig', 'Bo-Ltn'),
      ],
      authorities: [authority('auth-t1', 'eka')],
    });
    const termOf = glossaryTermOf(terms, [
      ...edges,
      { parent_uuid: 'not-a-term', child_uuid: 'stray' },
    ]);
    expect([...termOf]).toEqual([
      ['t1', 't1'],
      ['t1-bo', 't1'],
    ]);
  });
});

describe('termDefinition', () => {
  it('follows the rend rules', () => {
    expect(termDefinition('work', 'std', null)).toBe('work');
    expect(termDefinition(null, 'std', null)).toBe('');
    expect(termDefinition('work', 'std', 'overrideWithStandard')).toBe('std');
    expect(termDefinition('work', 'std', 'incompatibleWithStandard')).toBe(
      'work',
    );
    expect(termDefinition('work', 'std', 'appendWithStandard')).toBe(
      'work std',
    );
    expect(termDefinition('work', 'std', 'prependWithStandard')).toBe(
      'std work',
    );
    expect(termDefinition('work', 'std', 'bothWithStandard')).toBe('std work');
  });

  it('does not repeat a standard definition the work already quotes', () => {
    expect(
      termDefinition('<p>see std here</p>', '<i>std</i>', 'appendWithStandard'),
    ).toBe('<p>see std here</p>');
  });

  it('is empty when either side of a combination is null, as SQL concatenation is', () => {
    expect(termDefinition(null, 'std', 'appendWithStandard')).toBe('');
    expect(termDefinition('work', null, 'prependWithStandard')).toBe('');
  });
});

describe('formatAttestation', () => {
  it('splits camel case and title-cases words', () => {
    expect(formatAttestation('sourceUnspecified')).toBe('Source Unspecified');
    expect(formatAttestation('attestedSource')).toBe('Attested Source');
    expect(formatAttestation('reconstructedSemantic')).toBe(
      'Reconstructed Semantic',
    );
  });

  it('is null for blank input', () => {
    expect(formatAttestation(null)).toBeNull();
    expect(formatAttestation('  ')).toBeNull();
  });
});
