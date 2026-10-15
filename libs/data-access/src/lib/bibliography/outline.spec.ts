import { outlineBibliography } from './outline';
import type { BibliographyRow } from '../types';

const row = (
  uuid: string,
  sort: number,
  headingUuid: string | null,
  isHeading = false,
): BibliographyRow => ({
  uuid,
  workUuid: 'work-1',
  html: uuid,
  sort,
  isHeading,
  headingUuid,
});

const placesOf = (rows: BibliographyRow[]) =>
  Object.fromEntries(outlineBibliography(rows));

describe('outlineBibliography', () => {
  it('numbers nested headings and their entries as the readers do', () => {
    expect(
      placesOf([
        row('h1', 1, null, true),
        row('e1', 2, 'h1'),
        row('h2', 3, 'h1', true),
        row('e3', 4, 'h2'),
        row('e2', 5, 'h1'),
        row('h3', 6, null, true),
        row('e4', 7, 'h3'),
      ]),
    ).toEqual({
      h1: { depth: 0, label: '1' },
      e1: { depth: 1, label: '1.1' },
      h2: { depth: 1, label: '1.1' },
      e3: { depth: 2, label: '1.1.1' },
      e2: { depth: 1, label: '1.2' },
      h3: { depth: 0, label: '2' },
      e4: { depth: 1, label: '2.1' },
    });
  });

  it('numbers by sort, whatever the input order', () => {
    expect(
      placesOf([row('e2', 3, null), row('e1', 2, null), row('e3', 9, null)]),
    ).toEqual({
      e1: { depth: 0, label: '1' },
      e2: { depth: 0, label: '2' },
      e3: { depth: 0, label: '3' },
    });
  });

  it('gives no label to rows no reader shows', () => {
    expect(
      placesOf([
        row('h1', 1, 'h2', true),
        row('h2', 2, 'h1', true),
        row('e1', 3, 'h1'),
        row('e2', 4, 'missing'),
      ]),
    ).toEqual({
      h1: { depth: 0, label: null },
      h2: { depth: 0, label: null },
      e1: { depth: 1, label: null },
      e2: { depth: 0, label: null },
    });
  });
});
