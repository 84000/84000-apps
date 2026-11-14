/**
 * Acceptance tests: a published lookup never reads the draft `glossaries` or
 * `glossary_edges` tables. A glossary uuid resolves through
 * `published_glossaries_live`; a glossary xmlId does not resolve. A draft lookup
 * reads `glossaries` as before, and the other entity types are unchanged.
 */
import { lookup } from './lookup';
import type { DataClient } from './types/client';

type Row = Record<string, unknown>;
type Filter = { column: string; value: unknown };

const DRAFT_RELATIONS = ['glossaries', 'glossary_edges'];
const PUBLISHED = 'published_glossaries_live';

/**
 * A Supabase-like client over `relations`. `eq` filters are applied on
 * `maybeSingle`. When `forbidDraft` is set, reading a draft glossary relation
 * is recorded and throws.
 */
const createClient = ({
  relations = {},
  forbidDraft,
}: {
  relations?: Record<string, Row[]>;
  forbidDraft: boolean;
}) => {
  const queries: Array<{ relation: string; filters: Filter[] }> = [];
  const violations: string[] = [];

  const client = {
    from: (relation: string) => {
      if (forbidDraft && DRAFT_RELATIONS.includes(relation)) {
        violations.push(relation);
        throw new Error(`forbidden read of ${relation}`);
      }
      const applied: Filter[] = [];
      const proxy: unknown = new Proxy(
        {
          eq: (column: string, value: unknown) => {
            applied.push({ column, value });
            return proxy;
          },
          maybeSingle: async () => {
            queries.push({ relation, filters: [...applied] });
            const data = (relations[relation] ?? []).find((row) =>
              applied.every(({ column, value }) => row[column] === value),
            );
            return { data: data ?? null, error: null };
          },
        },
        {
          get: (obj, prop) =>
            prop in obj
              ? (obj as Record<string, unknown>)[prop as string]
              : () => proxy,
        },
      );
      return proxy;
    },
  };

  return { client: client as unknown as DataClient, queries, violations };
};

/** A published glossary row; carries `uuid` too so either select shape resolves. */
const publishedGlossary = (uuid: string): Row => ({
  glossary_uuid: uuid,
  uuid,
  work_uuid: 'work-1',
});

describe('lookup, glossary (DEV-915 criteria 2-4, 8)', () => {
  describe('published source', () => {
    const relations = {
      [PUBLISHED]: [publishedGlossary('g-root')],
      glossaries: [
        {
          uuid: 'g-child',
          glossary_xmlId: 'xml-child',
          termType: 'translationMain',
        },
        {
          uuid: 'g-xml',
          glossary_xmlId: 'xml-root',
          termType: 'translationMain',
        },
      ],
      glossary_edges: [{ parent_uuid: 'g-root', child_uuid: 'g-child' }],
    };

    it.each([
      ['by default', {}],
      ['when asked for explicitly', { source: 'published' as const }],
    ])(
      'resolves a glossary uuid through published_glossaries_live, %s',
      async (_label, extra) => {
        const { client, queries, violations } = createClient({
          relations,
          forbidDraft: true,
        });

        await expect(
          lookup({ client, uuid: 'g-root', type: 'glossary', ...extra }),
        ).resolves.toEqual({ uuid: 'g-root', type: 'glossary' });

        expect(violations).toEqual([]);
        expect(queries).toEqual([
          {
            relation: PUBLISHED,
            filters: [{ column: 'glossary_uuid', value: 'g-root' }],
          },
        ]);
      },
    );

    it('resolves an unscoped uuid to a published glossary without reading the draft tables', async () => {
      const { client, queries, violations } = createClient({
        relations,
        forbidDraft: true,
      });

      await expect(
        lookup({ client, uuid: 'g-root', source: 'published' }),
      ).resolves.toEqual({ uuid: 'g-root', type: 'glossary' });

      expect(violations).toEqual([]);
      expect(queries.map((query) => query.relation)).toContain(PUBLISHED);
    });

    it('does not resolve a uuid that only exists in the draft glossaries', async () => {
      const { client, violations } = createClient({
        relations,
        forbidDraft: true,
      });

      await expect(
        lookup({
          client,
          uuid: 'g-child',
          type: 'glossary',
          source: 'published',
        }),
      ).resolves.toBeNull();
      expect(violations).toEqual([]);
    });

    it('does not resolve a glossary xmlId and never reads glossaries', async () => {
      const { client, violations } = createClient({
        relations,
        forbidDraft: true,
      });

      await expect(
        lookup({
          client,
          xmlId: 'xml-root',
          type: 'glossary',
          source: 'published',
        }),
      ).resolves.toBeNull();
      await expect(
        lookup({ client, xmlId: 'xml-root', type: 'glossary' }),
      ).resolves.toBeNull();
      expect(violations).toEqual([]);
    });

    it('still resolves a bibliography xmlId after the glossary step finds nothing', async () => {
      const { client, queries, violations } = createClient({
        relations: {
          ...relations,
          bibliographies: [{ uuid: 'b-2', xmlId: 'shared-xml' }],
        },
        forbidDraft: true,
      });

      await expect(
        lookup({ client, xmlId: 'shared-xml', source: 'published' }),
      ).resolves.toEqual({ uuid: 'b-2', type: 'bibliography' });

      expect(violations).toEqual([]);
      expect(queries.map((query) => query.relation)).toContain(
        'bibliographies',
      );
    });

    it('still resolves a bibliography uuid after the glossary step finds nothing', async () => {
      const { client, violations } = createClient({
        relations: { bibliographies: [{ uuid: 'b-1' }] },
        forbidDraft: true,
      });

      await expect(
        lookup({ client, uuid: 'b-1', source: 'published' }),
      ).resolves.toEqual({ uuid: 'b-1', type: 'bibliography' });
      expect(violations).toEqual([]);
    });
  });

  describe('draft source', () => {
    const relations = {
      glossaries: [
        {
          uuid: 'g-child',
          glossary_xmlId: 'xml-child',
          termType: 'translationAlternative',
        },
        {
          uuid: 'g-root',
          glossary_xmlId: 'xml-root',
          termType: 'translationMain',
        },
      ],
    };

    it('resolves a glossary uuid through glossaries', async () => {
      const { client, queries } = createClient({
        relations,
        forbidDraft: false,
      });

      await expect(
        lookup({ client, uuid: 'g-child', type: 'glossary', source: 'draft' }),
      ).resolves.toEqual({ uuid: 'g-child', type: 'glossary' });

      expect(queries).toEqual([
        {
          relation: 'glossaries',
          filters: [{ column: 'uuid', value: 'g-child' }],
        },
      ]);
    });

    it('resolves a glossary xmlId through glossaries, among translationMain terms', async () => {
      const { client, queries } = createClient({
        relations,
        forbidDraft: false,
      });

      await expect(
        lookup({
          client,
          xmlId: 'xml-root',
          type: 'glossary',
          source: 'draft',
        }),
      ).resolves.toEqual({ uuid: 'g-root', type: 'glossary' });
      await expect(
        lookup({
          client,
          xmlId: 'xml-child',
          type: 'glossary',
          source: 'draft',
        }),
      ).resolves.toBeNull();

      expect(queries[0]).toEqual({
        relation: 'glossaries',
        filters: [
          { column: 'glossary_xmlId', value: 'xml-root' },
          { column: 'termType', value: 'translationMain' },
        ],
      });
    });

    it('does not read the published view', async () => {
      const { client, queries } = createClient({
        relations,
        forbidDraft: false,
      });

      await lookup({
        client,
        uuid: 'g-root',
        type: 'glossary',
        source: 'draft',
      });

      expect(queries.map((query) => query.relation)).not.toContain(PUBLISHED);
    });
  });
});

describe('lookup, other entity types (DEV-915 criterion 8)', () => {
  const relations = {
    work_toh: [{ toh_clean: 'toh1', work_uuid: 'work-1' }],
    works: [{ uuid: 'work-1', xmlId: 'work-xml' }],
    passages: [{ uuid: 'p-1', xmlId: 'passage-xml' }],
    bibliographies: [{ uuid: 'b-1', xmlId: 'bib-xml' }],
  };

  it.each(['draft', 'published'] as const)(
    'resolves toh, work, passage and bibliography the same for the %s source',
    async (source) => {
      const { client, violations } = createClient({
        relations,
        forbidDraft: source === 'published',
      });

      await expect(lookup({ client, toh: 'toh1', source })).resolves.toEqual({
        uuid: 'work-1',
        type: 'work',
      });
      await expect(
        lookup({ client, uuid: 'work-1', type: 'work', source }),
      ).resolves.toEqual({ uuid: 'work-1', type: 'work' });
      await expect(
        lookup({ client, xmlId: 'passage-xml', type: 'passage', source }),
      ).resolves.toEqual({ uuid: 'p-1', type: 'passage' });
      await expect(
        lookup({ client, xmlId: 'bib-xml', type: 'bibliography', source }),
      ).resolves.toEqual({ uuid: 'b-1', type: 'bibliography' });
      expect(violations).toEqual([]);
    },
  );
});
