import {
  annotation,
  bibliography,
  draftWork,
  glossaryTerm,
  passage,
} from './test-fixtures';
import { validateDraftWork } from './validate';

const rules = (findings: { rule: string }[]) => findings.map((f) => f.rule);

describe('validateDraftWork', () => {
  it('passes a well-formed work', () => {
    const result = validateDraftWork(draftWork());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  describe('passage ordering', () => {
    it('hard-fails a work with no passages', () => {
      const result = validateDraftWork(
        draftWork({ passages: [], annotations: [] }),
      );
      expect(result.ok).toBe(false);
      expect(rules(result.errors)).toContain('passages-empty');
    });

    it('hard-fails passages with no sort value', () => {
      const result = validateDraftWork(
        draftWork({
          passages: [passage({ uuid: 'p-1', sort: null })],
          annotations: [],
        }),
      );
      expect(rules(result.errors)).toContain('passage-sort-missing');
    });

    it('hard-fails duplicate sort values, which make ordering ambiguous', () => {
      const result = validateDraftWork(
        draftWork({
          passages: [
            passage({ uuid: 'p-1', sort: 5 }),
            passage({ uuid: 'p-2', sort: 5 }),
          ],
          annotations: [],
        }),
      );
      expect(rules(result.errors)).toContain('passage-sort-duplicate');
    });
  });

  describe('glossary-instance resolution', () => {
    it('hard-fails an instance pointing at a term outside the snapshot', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'glossary-instance',
          content: [{ type: 'glossary', uuid: 'not-in-this-work' }],
        }),
      ];

      const result = validateDraftWork(draft);
      expect(result.ok).toBe(false);
      expect(rules(result.errors)).toContain('glossary-instance-unresolved');
    });

    it('hard-fails an instance with no uuid at all', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'glossary-instance',
          content: [{ glossary_xmlId: 'UT-1' }],
        }),
      ];

      expect(rules(validateDraftWork(draft).errors)).toContain(
        'glossary-instance-unresolved',
      );
    });

    it('accepts an instance resolving to a term in the snapshot', () => {
      const draft = draftWork();
      const termUuid = draft.glossary[0].glossary_uuid;
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'glossary-instance',
          content: [{ type: 'glossary', uuid: termUuid }],
        }),
      ];

      expect(validateDraftWork(draft).ok).toBe(true);
    });

    it('ignores deprecated annotations entirely, as the reader does', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'deprecated-internal-link',
          content: [{ href: '/source/toh8/folio/6174' }],
        }),
      ];

      expect(validateDraftWork(draft).ok).toBe(true);
    });
  });

  describe('inline markers', () => {
    it('hard-fails an end-note-link pointing outside the snapshot', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'end-note-link',
          content: [{ uuid: 'missing-passage' }],
        }),
      ];

      expect(rules(validateDraftWork(draft).errors)).toContain(
        'inline-marker-unresolved',
      );
    });

    it('accepts an end-note-link resolving within the snapshot', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'end-note-link',
          content: [{ uuid: draft.passages[1].uuid }],
        }),
      ];

      expect(validateDraftWork(draft).ok).toBe(true);
    });

    it('does not require cross-work mentions to resolve locally', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'mention',
          content: [{ type: 'passage', uuid: 'elsewhere', same_work: false }],
        }),
      ];

      expect(validateDraftWork(draft).ok).toBe(true);
    });

    // In production, `mention` annotations with same_work ABSENT target another work
    // 6,800 times out of 7,362. Treating absent as same-work would hard-fail 167 works
    // whose cross-work links are valid.
    it('treats a mention with no same_work flag as cross-work, not local', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'mention',
          content: [{ type: 'passage', uuid: 'not-in-this-snapshot' }],
        }),
      ];

      expect(validateDraftWork(draft).ok).toBe(true);
    });

    it('does require a mention declaring same_work to resolve locally', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'mention',
          content: [
            { type: 'passage', uuid: 'not-in-this-snapshot', same_work: true },
          ],
        }),
      ];

      expect(rules(validateDraftWork(draft).errors)).toContain(
        'inline-marker-unresolved',
      );
    });

    // 258 of 1,432 internal-links legitimately point at another work.
    it('treats an internal-link with no same_work flag as cross-work', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'internal-link',
          content: [{ type: 'passage', uuid: 'another-work-passage' }],
        }),
      ];

      expect(validateDraftWork(draft).ok).toBe(true);
    });

    // Abbreviations always target the same work in production (all 1,663), so they are
    // checked regardless of any same_work flag.
    it('requires abbreviations to resolve locally even with no same_work flag', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'abbreviation',
          content: [{ uuid: 'not-in-this-snapshot' }],
        }),
      ];

      expect(rules(validateDraftWork(draft).errors)).toContain(
        'inline-marker-unresolved',
      );
    });

    it('resolves a glossary-target mention against the published glossary', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-ok',
          passage_uuid: draft.passages[0].uuid,
          type: 'mention',
          content: [
            {
              type: 'glossary',
              uuid: draft.glossary[0].glossary_uuid,
              same_work: true,
            },
          ],
        }),
      ];
      expect(validateDraftWork(draft).ok).toBe(true);

      draft.annotations = [
        annotation({
          uuid: 'a-bad',
          passage_uuid: draft.passages[0].uuid,
          type: 'mention',
          content: [
            { type: 'glossary', uuid: 'no-such-term', same_work: true },
          ],
        }),
      ];
      expect(rules(validateDraftWork(draft).errors)).toContain(
        'inline-marker-unresolved',
      );
    });

    it('does not require folio mentions to resolve as passages', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'mention',
          content: [{ type: 'folio', uuid: 'folio-uuid' }],
        }),
      ];

      expect(validateDraftWork(draft).ok).toBe(true);
    });

    it('hard-fails an annotation whose own passage is missing', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({ uuid: 'a-1', passage_uuid: 'no-such-passage' }),
      ];

      expect(rules(validateDraftWork(draft).errors)).toContain(
        'annotation-passage-missing',
      );
    });
  });

  describe('draft-only references', () => {
    it('hard-fails an annotation referenced only by xmlId', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'abbreviation',
          content: [{ abbreviation_xmlId: 'UT22084-001/abbreviation' }],
        }),
      ];

      const result = validateDraftWork(draft);
      expect(result.ok).toBe(false);
      expect(rules(result.errors)).toContain('xmlid-strip-orphan');
    });

    it('warns but does not fail when the xmlId is redundant beside a uuid', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'glossary-instance',
          content: [
            {
              type: 'glossary',
              uuid: draft.glossary[0].glossary_uuid,
              glossary_xmlId: 'UT22084-051-001-3225',
            },
          ],
        }),
      ];

      const result = validateDraftWork(draft);
      expect(result.ok).toBe(true);
      expect(rules(result.warnings)).toContain('xmlid-stripped');
    });
  });

  describe('bibliography', () => {
    it('hard-fails a heading reference outside the snapshot', () => {
      const draft = draftWork();
      draft.bibliographies = [
        bibliography({ uuid: 'b-1', heading_uuid: 'missing-heading' }),
      ];

      expect(rules(validateDraftWork(draft).errors)).toContain(
        'bibliography-heading-unresolved',
      );
    });

    it('accepts a heading reference within the snapshot', () => {
      const draft = draftWork();
      draft.bibliographies = [
        bibliography({ uuid: 'b-head', is_heading: true }),
        bibliography({ uuid: 'b-1', heading_uuid: 'b-head' }),
      ];

      expect(validateDraftWork(draft).ok).toBe(true);
    });
  });

  describe('non-critical metadata', () => {
    it('warns rather than fails on an empty glossary and bibliography', () => {
      const result = validateDraftWork(
        draftWork({ glossary: [], bibliographies: [], annotations: [] }),
      );

      expect(result.ok).toBe(true);
      expect(rules(result.warnings)).toEqual(
        expect.arrayContaining(['glossary-empty', 'bibliography-empty']),
      );
    });

    it('warns on a missing toh and title', () => {
      const result = validateDraftWork(draftWork({ toh: null, title: '  ' }));
      expect(result.ok).toBe(true);
      expect(rules(result.warnings)).toEqual(
        expect.arrayContaining(['toh-missing', 'title-missing']),
      );
    });

    it('warns on empty passage content', () => {
      const result = validateDraftWork(
        draftWork({
          passages: [passage({ uuid: 'p-1', content: '' })],
          annotations: [],
        }),
      );
      expect(result.ok).toBe(true);
      expect(rules(result.warnings)).toContain('passage-content-empty');
    });
  });

  it('caps listed subjects but reports the true count', () => {
    const passages = Array.from({ length: 40 }, (_, index) =>
      passage({ uuid: `p-${index}`, sort: null }),
    );
    const result = validateDraftWork(draftWork({ passages, annotations: [] }));
    const found = result.errors.find((e) => e.rule === 'passage-sort-missing');

    expect(found?.count).toBe(40);
    expect(found?.subjects).toHaveLength(20);
  });

  it('reports every independent failure at once, not just the first', () => {
    const draft = draftWork({
      passages: [passage({ uuid: 'p-1', sort: null })],
      bibliographies: [bibliography({ uuid: 'b-1', heading_uuid: 'nope' })],
      glossary: [glossaryTerm({ glossary_uuid: 'g-1' })],
    });
    draft.annotations = [
      annotation({
        uuid: 'a-1',
        passage_uuid: 'p-1',
        type: 'glossary-instance',
        content: [{ uuid: 'missing' }],
      }),
    ];

    expect(rules(validateDraftWork(draft).errors)).toEqual(
      expect.arrayContaining([
        'passage-sort-missing',
        'glossary-instance-unresolved',
        'bibliography-heading-unresolved',
      ]),
    );
  });
});
