import type { DataClient } from '@eightyfourthousand/data-access';
import {
  isPublishedVersionLive,
  readSourceAnnotations,
  readSourceBibliographies,
  readSourceGlossary,
  readSourcePassages,
  type SourceWork,
} from './read-source';

const WORK = '2cd55d9c-a17c-4d9f-9fce-e32e05b0192d';
const VERSION = '7a1f0c3e-5b2d-4e8a-9c61-0d4b3f2e1a90';

const published: SourceWork = {
  uuid: WORK,
  tohs: ['toh145'],
  title: 'T',
  draftTouchedAt: null,
  source: 'published',
  versionUuid: VERSION,
};

/** A client that answers every query from fixed rows and logs each call it gets. */
const fakeClient = (
  rows: Record<string, Record<string, unknown>[]>,
  single: Record<string, unknown> | null = null,
) => {
  const calls: string[] = [];
  const client = {
    from: (table: string) => {
      const log: string[] = [table];
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in', 'not', 'is', 'or', 'gt']) {
        builder[method] = (...args: unknown[]) => {
          log.push(
            `${method}(${args.map((a) => JSON.stringify(a)).join(',')})`,
          );
          return builder;
        };
      }
      builder['order'] = () => builder;
      builder['limit'] = async () => {
        calls.push(log.join('.'));
        return { data: rows[table] ?? [], error: null };
      };
      builder['maybeSingle'] = async () => {
        calls.push(log.join('.'));
        return { data: single, error: null };
      };
      return builder;
    },
  } as unknown as DataClient;
  return { client, calls };
};

describe('published reads', () => {
  it('scope every relation to the work and its live version', async () => {
    const { client, calls } = fakeClient({});
    await readSourcePassages(client, published);
    await readSourceBibliographies(client, published);
    await readSourceGlossary(client, published);
    for (const table of [
      'published_passages',
      'published_bibliographies',
      'published_glossaries',
    ]) {
      const reads = calls.filter((c) => c.startsWith(`${table}.`));
      expect(reads.length).toBeGreaterThan(0);
      for (const read of reads) {
        expect(read).toContain(`eq("work_uuid","${WORK}")`);
        expect(read).toContain(`eq("version_uuid","${VERSION}")`);
      }
    }
  });

  it('never return draft-only annotations, and keep only the work’s passages', async () => {
    const { client, calls } = fakeClient({
      published_passage_annotations: [
        { uuid: 'a1', passage_uuid: 'p1', type: 'link' },
        { uuid: 'a2', passage_uuid: 'other', type: 'link' },
      ],
    });
    const rows = await readSourceAnnotations(client, published, ['p1']);
    expect(rows.map((r) => r.uuid)).toEqual(['a1']);
    expect(calls[0]).toContain(`eq("version_uuid","${VERSION}")`);
    expect(calls[0]).toMatch(/not\("type","in","\(comment\)"\)/);
  });

  it('resolve glossary instances through the term edges', async () => {
    const { client, calls } = fakeClient({
      published_glossaries: [{ glossary_uuid: 'g1', term_number: 1 }],
      glossary_edges: [{ parent_uuid: 'g1', child_uuid: 'g1-alt' }],
    });
    const { termOf } = await readSourceGlossary(client, published);
    expect(calls.some((c) => c.startsWith('glossary_edges.'))).toBe(true);
    expect(termOf.get('g1-alt')).toBe('g1');
  });
});

describe('isPublishedVersionLive', () => {
  it('is true only while the work still points at the version that was read', async () => {
    const live = fakeClient({}, { published_version_uuid: VERSION });
    const moved = fakeClient({}, { published_version_uuid: 'newer' });
    await expect(isPublishedVersionLive(live.client, published)).resolves.toBe(
      true,
    );
    await expect(isPublishedVersionLive(moved.client, published)).resolves.toBe(
      false,
    );
  });
});
