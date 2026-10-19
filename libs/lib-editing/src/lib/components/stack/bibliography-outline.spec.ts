import type { BibliographyRow } from '@eightyfourthousand/data-access';
import type { SpineEntry } from '@eightyfourthousand/lib-doc-model';

import { outlineBibliographyRows } from './bibliography-outline';
import { BIBLIOGRAPHY_SEED_ROWS } from './bibliography-seed.fixture';
import { bibliographySeeds } from './bibliography-work';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

type Row = { uuid: string; heading?: boolean; parent?: string };

/** Spine entries in the given order. */
const spine = (rows: Row[]): SpineEntry[] =>
  rows.map(
    ({ uuid, heading, parent }, index) =>
      ({
        uuid,
        label: '',
        type: heading ? 'bibliographyHeader' : 'bibliography',
        sort: index + 1,
        ...(parent ? { parent } : {}),
        index,
      }) as SpineEntry,
  );

/** What the outline gives, as the seeds would hold it. */
const outlined = (entries: SpineEntry[]) => {
  const places = outlineBibliographyRows(entries);
  return entries.map((entry) => ({
    uuid: entry.uuid,
    ...places.get(entry.uuid),
  }));
};

/** A work's seed rows, each entry under the heading before it. */
const seedRows = (toh: string): BibliographyRow[] => {
  let heading: string | null = null;
  return BIBLIOGRAPHY_SEED_ROWS.filter((row) => row.toh === toh).map((row) => {
    const uuid = `${toh}-${row.sort}`;
    const stored: BibliographyRow = {
      uuid,
      workUuid: toh,
      html: row.html,
      sort: row.sort,
      isHeading: row.isHeading,
      headingUuid: row.isHeading ? null : heading,
    };
    if (row.isHeading) heading = uuid;
    return stored;
  });
};

const NESTED: BibliographyRow[] = [
  { uuid: 'h1', sort: 1, isHeading: true, headingUuid: null },
  { uuid: 'e1', sort: 2, isHeading: false, headingUuid: 'h1' },
  { uuid: 'h2', sort: 3, isHeading: true, headingUuid: null },
  { uuid: 'h3', sort: 4, isHeading: true, headingUuid: 'h2' },
  { uuid: 'e3', sort: 5, isHeading: false, headingUuid: 'h3' },
  { uuid: 'e2', sort: 6, isHeading: false, headingUuid: 'h2' },
  { uuid: 'h4', sort: 7, isHeading: true, headingUuid: 'h2' },
].map((row) => ({ ...row, workUuid: 'w1', html: row.uuid }));

describe('outlineBibliographyRows', () => {
  it.each([
    ['nested headings', NESTED],
    ['toh90001', seedRows('toh90001')],
    ['toh145', seedRows('toh145')],
    ['toh251', seedRows('toh251')],
  ])('numbers %s as the readers do', (_name, rows) => {
    const seeds = bibliographySeeds(rows);
    const entries = seeds.map(
      (seed, index) => ({ ...seed, label: '', index }) as SpineEntry,
    );
    expect(outlined(entries)).toEqual(
      seeds.map(({ uuid, label, parent, depth }) => ({
        uuid,
        label,
        ...(parent ? { parent } : {}),
        ...(depth ? { depth } : {}),
      })),
    );
  });

  it('numbers the entries of a work without headings on their own', () => {
    expect(outlined(spine([{ uuid: 'a' }, { uuid: 'b' }]))).toEqual([
      { uuid: 'a', label: 'b.1' },
      { uuid: 'b', label: 'b.2' },
    ]);
  });

  it('puts each entry under the heading before it', () => {
    expect(
      outlined(
        spine([
          { uuid: 'h1', heading: true },
          { uuid: 'a', parent: 'gone' },
          { uuid: 'h2', heading: true },
          { uuid: 'b' },
        ]),
      ),
    ).toEqual([
      { uuid: 'h1', label: 'b.1' },
      { uuid: 'a', label: 'b.1.1', parent: 'h1', depth: 1 },
      { uuid: 'h2', label: 'b.2' },
      { uuid: 'b', label: 'b.2.1', parent: 'h2', depth: 1 },
    ]);
  });

  it('labels no heading the top level cannot reach, nor its entries', () => {
    expect(
      outlined(
        spine([
          { uuid: 'h1', heading: true, parent: 'h2' },
          { uuid: 'a' },
          { uuid: 'h2', heading: true, parent: 'h1' },
          { uuid: 'h3', heading: true, parent: 'a' },
        ]),
      ),
    ).toEqual([
      { uuid: 'h1', label: '', parent: 'h2' },
      { uuid: 'a', label: '', parent: 'h1', depth: 1 },
      { uuid: 'h2', label: '', parent: 'h1' },
      { uuid: 'h3', label: '', parent: 'a' },
    ]);
  });
});
