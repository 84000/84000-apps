/**
 * Fixture builders for lib-publishing tests.
 *
 * Deliberately minimal and valid by default, so each test can introduce exactly one
 * defect and assert on that one rule.
 */

import type {
  DraftAnnotation,
  DraftBibliography,
  DraftGlossaryTerm,
  DraftPassage,
  DraftWork,
} from './types';

export const WORK_UUID = '11111111-1111-4111-8111-111111111111';
export const VERSION_UUID = '22222222-2222-4222-8222-222222222222';
export const AUTHORITY_UUID = '33333333-3333-4333-8333-333333333333';

export const passage = (
  overrides: Partial<DraftPassage> & { uuid: string },
): DraftPassage => ({
  work_uuid: WORK_UUID,
  content: 'Thus have I heard.',
  label: '1.1',
  sort: 1,
  parent: null,
  type: 'translation-paragraph',
  toh: 'toh999',
  ...overrides,
});

export const annotation = (
  overrides: Partial<DraftAnnotation> & { uuid: string; passage_uuid: string },
): DraftAnnotation => ({
  type: 'span',
  start: 0,
  end: 4,
  content: [{ 'text-style': 'foreign' }],
  toh: 'toh999',
  ...overrides,
});

export const glossaryTerm = (
  overrides: Partial<DraftGlossaryTerm> & { glossary_uuid: string },
): DraftGlossaryTerm => ({
  authority_uuid: AUTHORITY_UUID,
  work_uuid: WORK_UUID,
  headword: 'bodhisattva',
  headword_language: 'sa',
  english: 'bodhisattva',
  wylie: 'byang chub sems dpa',
  tibetan: 'བྱང་ཆུབ་སེམས་དཔའ',
  sanskrit_plain: 'bodhisattva',
  sanskrit_attested: 'bodhisattva',
  chinese: null,
  pali: null,
  alternatives: null,
  definition: '<p>An awakening being.</p>',
  english_sort: 'bodhisattva',
  headword_sort: 'bodhisattva',
  term_number: 1,
  search_text: 'bodhisattva',
  ...overrides,
});

export const bibliography = (
  overrides: Partial<DraftBibliography> & { uuid: string },
): DraftBibliography => ({
  work_uuid: WORK_UUID,
  bibl_html: '<p>A source.</p>',
  sort: 1,
  heading: null,
  is_heading: false,
  heading_uuid: null,
  toh: 'toh999',
  ...overrides,
});

/** A valid draft work: two passages, one glossary term, one bibliography entry. */
export const draftWork = (overrides: Partial<DraftWork> = {}): DraftWork => {
  const p1 = passage({ uuid: 'aaaaaaa1-0000-4000-8000-000000000001', sort: 1 });
  const p2 = passage({ uuid: 'aaaaaaa1-0000-4000-8000-000000000002', sort: 2 });

  return {
    workUuid: WORK_UUID,
    toh: 'toh999',
    title: 'A Test Sutra',
    publicationVersion: null,
    publishedVersionUuid: null,
    passages: [p1, p2],
    annotations: [
      annotation({
        uuid: 'bbbbbbb1-0000-4000-8000-000000000001',
        passage_uuid: p1.uuid,
      }),
    ],
    glossary: [
      glossaryTerm({ glossary_uuid: 'ccccccc1-0000-4000-8000-000000000001' }),
    ],
    bibliographies: [
      bibliography({ uuid: 'ddddddd1-0000-4000-8000-000000000001' }),
    ],
    alignments: [],
    ...overrides,
  };
};
