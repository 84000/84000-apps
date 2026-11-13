import { placeGlossaryRow } from './glossary-place';
import {
  client,
  loaded as loadedWith,
  node,
  page,
  rows,
  WORK,
} from './glossary-rows.fixture';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockPage = jest.fn();
const mockEntries = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getWorkGlossaryTermsPage: (args: unknown) => mockPage(args),
  getGlossaryEntries: (args: unknown) => mockEntries(args),
}));

const mocks = { page: mockPage, entries: mockEntries };

const loaded = (more?: { after: boolean }) => loadedWith(mocks, more);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('placeGlossaryRow', () => {
  it('puts the row between its neighbours and renumbers the rows after it', async () => {
    const glossary = await loaded();
    mockPage.mockResolvedValueOnce(
      page([node('t1', 1), node('c', 2), node('t2', 3)]),
    );

    expect(await placeGlossaryRow({ glossary, uuid: 'c', client })).toBe(true);

    expect(mockPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        workUuid: WORK,
        cursor: 'c',
        direction: 'AROUND',
        source: 'draft',
      }),
    );
    expect(rows(glossary)).toEqual(['g.1 t1', 'g.2 c', 'g.3 t2', 'g.4 t3']);
    expect(glossary.work.spine.meta('c')).toMatchObject({
      type: 'glossary',
      sort: 2,
    });
  });

  it('puts a row that sorts first before the first row', async () => {
    const glossary = await loaded();
    mockPage.mockResolvedValueOnce(page([node('c', 1), node('t1', 2)]));

    await placeGlossaryRow({ glossary, uuid: 'c', client });

    expect(rows(glossary)).toEqual(['g.1 c', 'g.2 t1', 'g.3 t2', 'g.4 t3']);
  });

  it('puts a row that sorts last after the last row', async () => {
    const glossary = await loaded();
    mockPage.mockResolvedValueOnce(page([node('t3', 3), node('c', 4)]));

    await placeGlossaryRow({ glossary, uuid: 'c', client });

    expect(rows(glossary).at(-1)).toBe('g.4 c');
  });

  it('leaves a row outside the window for the feed', async () => {
    const glossary = await loaded({ after: true });
    mockPage.mockResolvedValueOnce(
      page([node('t7', 7), node('c', 8), node('t8', 9)]),
    );

    expect(await placeGlossaryRow({ glossary, uuid: 'c', client })).toBe(false);

    expect(rows(glossary)).toEqual(['g.1 t1', 'g.2 t2', 'g.3 t3']);
  });
});
