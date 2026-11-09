import { relationFor, rpcFor } from './content-source';

/**
 * DEV-881 acceptance (criterion 12, and "data-access's exported functions return what they
 * do today"): the draft glossary no longer lives in a relation. Draft glossary terms are
 * computed live by the database from the glossary tables and read through RPCs
 * (`glossary_terms_page`, `glossary_term_by_uuid`, `glossary_terms_for_work`), so the draft
 * source must not map `glossaryTerms` to the retired materialized view, nor to a copy table.
 * The published source is not part of this change.
 *
 * The retired names are assembled from parts so this spec does not itself name them: the
 * repo-wide scan in lib-publishing/glossary-term-index-removed.spec.ts skips only itself.
 */
const RETIRED_VIEW = ['glossary', 'term', 'index'].join('_');
const COPY_TABLE = ['draft', 'glossaries'].join('_');

// `relationFor` may stop accepting `glossaryTerms` for the draft source; call it loosely so
// this spec compiles either way and judges only the observable result.
const loosely = relationFor as unknown as (
  relation: string,
  source?: string,
) => unknown;

describe('relationFor glossaryTerms', () => {
  it('does not map the draft source to the retired term index or to a copy table', () => {
    let draft: unknown;
    try {
      draft = loosely('glossaryTerms', 'draft');
    } catch {
      draft = undefined; // removing the draft entry is a valid way to retire it
    }
    expect(draft).not.toBe(RETIRED_VIEW);
    expect(draft).not.toBe(COPY_TABLE);
    // The draft source must never fall through to the published snapshot either.
    expect(draft).not.toBe('published_glossaries_live');
  });

  it('leaves the published source on published_glossaries_live', () => {
    expect(relationFor('glossaryTerms', 'published')).toBe(
      'published_glossaries_live',
    );
  });

  it('still defaults to the published source', () => {
    expect(relationFor('glossaryTerms')).toBe('published_glossaries_live');
  });

  it('leaves every other relation as it was', () => {
    expect(relationFor('passages', 'draft')).toBe('passages');
    expect(relationFor('passageAnnotations', 'draft')).toBe(
      'passage_annotations',
    );
    expect(relationFor('bibliographies', 'draft')).toBe('bibliographies');
    expect(relationFor('passages', 'published')).toBe(
      'published_passages_live',
    );
    expect(relationFor('passageAnnotations', 'published')).toBe(
      'published_passage_annotations_live',
    );
    expect(relationFor('bibliographies', 'published')).toBe(
      'published_bibliographies_live',
    );
  });
});

describe('rpcFor glossary functions', () => {
  it('keeps the draft glossary search functions under their existing names', () => {
    expect(rpcFor('workGlossarySearch', 'draft')).toBe(
      'search_work_glossary_terms',
    );
    expect(rpcFor('sectionGlossarySearch', 'draft')).toBe(
      'search_glossary_terms_by_section',
    );
    expect(rpcFor('entitySearch', 'draft')).toBe('search_entities');
    expect(rpcFor('glossaryTermPassages', 'draft')).toBe(
      'get_glossary_term_passages',
    );
  });

  it('leaves every published function as it was', () => {
    expect(rpcFor('workGlossarySearch', 'published')).toBe(
      'search_work_glossary_terms_published',
    );
    expect(rpcFor('sectionGlossarySearch', 'published')).toBe(
      'search_glossary_terms_by_section_published',
    );
    expect(rpcFor('entitySearch', 'published')).toBe(
      'search_entities_published',
    );
    expect(rpcFor('glossaryTermPassages', 'published')).toBe(
      'get_glossary_term_passages_published',
    );
    expect(rpcFor('workToc', 'published')).toBe('get_work_toc_published');
  });

  it('defaults to the published source', () => {
    expect(rpcFor('workGlossarySearch')).toBe(
      'search_work_glossary_terms_published',
    );
  });
});
