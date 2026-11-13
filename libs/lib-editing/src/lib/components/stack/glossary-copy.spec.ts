import { copyGlossaryRow } from './glossary-copy';
import {
  client,
  entry,
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
const mockCopy = jest.fn();
const mockRead = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getWorkGlossaryTermsPage: (args: unknown) => mockPage(args),
  getGlossaryEntries: (args: unknown) => mockEntries(args),
  copyGlossaryEntry: (args: unknown) => mockCopy(args),
  getGlossaryEntry: (args: unknown) => mockRead(args),
}));

const mocks = { page: mockPage, entries: mockEntries };

const loaded = (more?: { after: boolean }) => loadedWith(mocks, more);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('copyGlossaryRow', () => {
  const source = entry('s1', 'other-work');

  it('copies the entry into this work and places its row', async () => {
    const glossary = await loaded();
    mockCopy.mockResolvedValue({
      success: true,
      dryRun: false,
      entries: [entry('c')],
      deleted: [],
      changes: {},
    });
    mockPage.mockResolvedValueOnce(
      page([node('t2', 2), node('c', 3), node('t3', 4)]),
    );

    const result = await copyGlossaryRow({
      glossary,
      source,
      client,
      uuid: 'c',
    });

    expect(result).toEqual({ copied: true, entry: entry('c') });
    expect(mockCopy).toHaveBeenCalledWith({
      client,
      workUuid: WORK,
      source,
      uuid: 'c',
    });
    expect(rows(glossary)).toContain('g.3 c');
  });

  it('reports a refused copy and places nothing', async () => {
    const glossary = await loaded();
    mockCopy.mockResolvedValue({
      success: false,
      reason: 'forbidden',
      error: 'Permission denied',
      outcomeUnknown: false,
    });

    const result = await copyGlossaryRow({ glossary, source, client });

    expect(result).toEqual({ copied: false, error: 'Permission denied' });
    expect(rows(glossary)).toHaveLength(3);
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('reads the copy back when its answer was lost', async () => {
    const glossary = await loaded();
    mockCopy.mockResolvedValue({
      success: false,
      reason: 'failed',
      error: 'network',
      outcomeUnknown: true,
    });
    mockRead.mockResolvedValue({ status: 'found', entry: entry('c') });
    mockPage.mockResolvedValueOnce(page([node('t3', 3), node('c', 4)]));

    const result = await copyGlossaryRow({
      glossary,
      source,
      client,
      uuid: 'c',
    });

    expect(mockRead).toHaveBeenCalledWith({
      client,
      workUuid: WORK,
      uuid: 'c',
    });
    expect(result).toEqual({ copied: true, entry: entry('c') });
    expect(rows(glossary).at(-1)).toBe('g.4 c');
  });

  it('reports a lost copy that was not made', async () => {
    const glossary = await loaded();
    mockCopy.mockResolvedValue({
      success: false,
      reason: 'failed',
      error: 'network',
      outcomeUnknown: true,
    });
    mockRead.mockResolvedValue({ status: 'not-found' });

    const result = await copyGlossaryRow({ glossary, source, client });

    expect(result).toEqual({ copied: false, error: 'network' });
  });

  it('still reports the copy when placing its row fails', async () => {
    const glossary = await loaded();
    mockCopy.mockResolvedValue({
      success: true,
      dryRun: false,
      entries: [entry('c')],
      deleted: [],
      changes: {},
    });
    mockPage.mockRejectedValueOnce(new Error('offline'));

    const result = await copyGlossaryRow({ glossary, source, client });

    expect(result).toEqual({ copied: true, entry: entry('c') });
    expect(rows(glossary)).toHaveLength(3);
  });
});
