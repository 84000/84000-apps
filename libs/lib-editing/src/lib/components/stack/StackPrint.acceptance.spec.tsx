/**
 * Acceptance tests for DEV-837 item 5, AC2.1 to AC2.11: `StackPrint`, which
 * prints a stack reader's whole text. Printing starts only from Cmd/Ctrl+P;
 * there is no Print control.
 *
 * Written from the spec, not the implementation. Mounted as the spec says:
 * `StackReaderProvider > NavigationProvider > StackPrint`, with plain
 * children, the provider seeded so every section exists from the first
 * render. Only the
 * network (`client-graphql`), Next's router and `window.print` are faked.
 * `readStackForPrint` is wrapped, not replaced: it still reads, and the tests
 * note which controller each call was given and in what state. That is how the
 * order of the parts (AC2.4), the Toh (AC2.11) and a failed part (AC2.8) are
 * seen.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useEffect } from 'react';

import { NavigationProvider } from '../shared/NavigationProvider';
import type { StackController } from './StackController';
import { StackPrint } from './StackPrint';
import { StackReaderProvider } from './StackReaderProvider';
import type { StackReaderSeed, StackSectionSeed } from './stack-seed';
import { useStackWork } from './stack-work-context';

// See PassageStackController.spec.ts: building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({}),
  usePathname: () => '/',
}));
jest.mock('@eightyfourthousand/lib-instr', () => ({
  ...jest.requireActual('@eightyfourthousand/lib-instr'),
  useFeatureFlagEnabled: () => false,
}));
jest.mock('@eightyfourthousand/lib-instr/static', () => ({
  isStaticFeatureEnabled: () => false,
}));
jest.mock('../shared/HoverCardProvider', () => ({
  HoverCardProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
jest.mock('../shared/RestrictionWarning', () => ({
  RestrictionWarning: () => null,
}));

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({ request: jest.fn() })),
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  getTranslationBlocksAround: jest.fn(),
  getTranslationImprint: jest.fn(),
  getWorkGlossaryTerms: jest.fn(),
  getBibliographyEntry: jest.fn(),
  getGlossaryInstance: jest.fn(),
  getPassage: jest.fn(),
  getTranslationMetadataByUuid: jest.fn(),
  lookup: jest.fn(async () => null),
}));
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: jest.fn(() => ({})),
}));

// The editing provider's own collaborators, as StackWorkProvider.spec fakes
// them: the print only has to see that this provider can edit.
jest.mock('../editor/EditorProvider', () => ({
  useEditorState: () => ({
    registerSaveHandler: jest.fn(),
    dirtyStore: { setDirty: jest.fn() },
  }),
}));
jest.mock('./bibliography-work', () => ({
  ...jest.requireActual('./bibliography-work'),
  loadBibliographyWork: jest.fn(async () => null),
}));

// Wrapped, not replaced: see the header.
jest.mock('./stack-print', () => {
  const actual = jest.requireActual('./stack-print');
  return { ...actual, readStackForPrint: jest.fn(actual.readStackForPrint) };
});

const graphql = jest.requireMock('@eightyfourthousand/client-graphql') as {
  getPassageMetaPage: jest.Mock;
  getTranslationImprint: jest.Mock;
  getWorkGlossaryTerms: jest.Mock;
};
const printModule = jest.requireMock('./stack-print') as {
  readStackForPrint: jest.Mock;
};
const actualPrint = jest.requireActual('./stack-print') as {
  readStackForPrint: (
    controller: StackController,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown[] | null>;
};

const WORK = 'w1';
const TITLE = 'The Sutra of Printed Pages';
const PARTS = [
  'front',
  'translation',
  'abbreviations',
  'endnotes',
  'bibliography',
];

// ----------------------------------------------------------------- the seed

/** A section as the server reads it: whole, its rows reading "<name> <i> text". */
const section = (
  tab: string,
  type: string,
  name: string,
  count: number,
  tohOf?: (index: number) => string | undefined,
): StackSectionSeed => {
  const uuids = Array.from({ length: count }, (_, i) => `${tab}-${i}`);
  return {
    tab,
    page: {
      metas: uuids.map((uuid, i) => ({
        uuid,
        label: `${i + 1}`,
        type,
        ...(tohOf?.(i) ? { toh: tohOf(i) } : {}),
      })),
      nextCursor: uuids[count - 1],
      hasMoreAfter: false,
      hasMoreBefore: false,
    } as StackSectionSeed['page'],
    passages: uuids.map((uuid, i) => ({
      uuid,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: `${name} ${i} text` }],
        },
      ],
    })),
  };
};

/** The translation's row 1 belongs to another Toh than the one being read. */
const tohOf = (i: number) =>
  i === 1 ? 'toh847' : i === 0 ? 'toh145' : undefined;

/** Rows: front 2, translation 4 (3 for toh145), abbreviations 1, endnotes 2, bibliography 5. */
const seed = {
  workUuid: WORK,
  sections: [
    section('front', 'introduction', 'front', 2),
    section('translation', 'translation', 'translation', 4, tohOf),
    section('abbreviations', 'abbreviations', 'abbreviation', 1),
    section('endnotes', 'endnotes', 'endnote', 2),
  ],
  bibliography: [
    {
      heading: 'Tibetan Texts',
      label: '1',
      entries: [
        { uuid: 'b-1-1', label: '1.1', html: '<p>bib entry alpha</p>' },
        { uuid: 'b-1-2', label: '1.2', html: '<p>bib entry beta</p>' },
      ],
    },
    {
      heading: 'Secondary Sources',
      label: '2',
      entries: [
        { uuid: 'b-2-1', label: '2.1', html: '<p>bib entry gamma</p>' },
      ],
    },
  ],
} as unknown as StackReaderSeed;

const VISIBLE_ROWS = 2 + 3 + 1 + 2 + 5;

/** In the order they appear on the page, with the translation's toh847 row left out. */
const ROW_TEXT = [
  'front 0 text',
  'front 1 text',
  'translation 0 text',
  'translation 2 text',
  'translation 3 text',
  'abbreviation 0 text',
  'endnote 0 text',
  'endnote 1 text',
  'bib entry alpha',
  'bib entry beta',
  'bib entry gamma',
];

// --------------------------------------------------------------- the glossary

const termPage = (
  names: string[],
  next: { cursor: string } | null,
  total = 5,
) => ({
  terms: names.map((english, i) => ({
    uuid: `g-${english}`,
    authority: `a-${i}`,
    workUuid: WORK,
    termNumber: i,
    names: { english },
  })),
  nextCursor: next?.cursor,
  hasMoreAfter: !!next,
  hasMoreBefore: false,
  totalCount: total,
});

const TERMS = [
  'Term alpha',
  'Term beta',
  'Term gamma',
  'Term delta',
  'Term epsilon',
];

/** Three pages of terms, keyed by the cursor that asks for them. */
const pagedGlossary = async ({ cursor }: { cursor?: string }) => {
  if (!cursor) return termPage(TERMS.slice(0, 2), { cursor: 'c1' });
  if (cursor === 'c1') return termPage(TERMS.slice(2, 4), { cursor: 'c2' });
  return termPage(TERMS.slice(4), null);
};

// ---------------------------------------------------------- what the page saw

type Printed = {
  count: number;
  /** How many print elements there were, and whether each is a child of body. */
  elements: number;
  parentIsBody: boolean;
  text: string;
  html: string;
  headings: string[];
  styles: string;
};

let printed: Printed[];
/** What each `readStackForPrint` call was given, when it was called. */
let reads: { tab?: string; toh?: string; glossaryReads: number }[];
/** The parts whose read had finished, in order. */
let finished: string[];
/** The parts that had finished when each glossary page was asked for. */
let finishedAtGlossary: string[][];

const printElements = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-stack-print]'));

beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }) as unknown as typeof window.matchMedia;
  window.history.replaceState(null, '', '/');

  controllers = {};
  printed = [];
  reads = [];
  finished = [];
  finishedAtGlossary = [];
  window.print = jest.fn(() => {
    const [el] = printElements();
    printed.push({
      count: (window.print as jest.Mock).mock.calls.length,
      elements: printElements().length,
      parentIsBody: el?.parentElement === document.body,
      text: el?.textContent ?? '',
      html: el?.innerHTML ?? '',
      headings: Array.from(el?.querySelectorAll('h1,h2,h3,h4,h5,h6') ?? []).map(
        (heading) => heading.textContent?.trim() ?? '',
      ),
      styles: Array.from(document.querySelectorAll('style'))
        .map((style) => style.textContent ?? '')
        .join('\n'),
    });
  });

  graphql.getTranslationImprint
    .mockReset()
    .mockResolvedValue({ mainTitles: { en: TITLE } });
  graphql.getWorkGlossaryTerms
    .mockReset()
    .mockImplementation(async (args: { cursor?: string }) => {
      finishedAtGlossary.push([...finished]);
      return pagedGlossary(args);
    });
  graphql.getPassageMetaPage.mockReset().mockResolvedValue({
    metas: [],
    hasMoreAfter: false,
    hasMoreBefore: false,
  });
  printModule.readStackForPrint
    .mockReset()
    .mockImplementation(async (controller: StackController, options) => {
      reads.push({
        tab: controller.getTab(),
        toh: controller.getActiveToh(),
        glossaryReads: graphql.getWorkGlossaryTerms.mock.calls.length,
      });
      const rows = await actualPrint.readStackForPrint(controller, options);
      if (rows) finished.push(controller.getTab() ?? '');
      return rows;
    });
});

afterEach(() => {
  // Whatever a test left open.
  printElements().forEach((el) => el.remove());
});

// ------------------------------------------------------------------- mounting

const Reader = ({
  toh = 'toh145',
  children,
}: {
  toh?: `toh${number}`;
  children?: ReactNode;
}) => (
  <StackReaderProvider workUuid={WORK} seed={seed}>
    <NavigationProvider uuid={WORK} initialToh={toh}>
      <StackPrint>
        <span>page content</span>
        <Capture />
        {children}
      </StackPrint>
    </NavigationProvider>
  </StackReaderProvider>
);

/** Mounted, with the work's imprint read, so the title is there to print. */
const mount = async (props: Parameters<typeof Reader>[0] = {}) => {
  const view = render(<Reader {...props} />);
  await waitFor(() => expect(graphql.getTranslationImprint).toHaveBeenCalled());
  await act(async () => {
    // The imprint lands in navigation's state.
  });
  return view;
};

/** The stack's views, as the provider holds them, for what a row's HTML is. */
let controllers: Record<string, StackController | null>;

const Capture = () => {
  const stack = useStackWork();
  // After each render, not during it, so render stays free of side effects.
  useEffect(() => {
    PARTS.forEach((tab) => {
      controllers[tab] = stack?.controllerFor(tab) ?? null;
    });
  });
  return null;
};

const pressPrintShortcut = (init: KeyboardEventInit) =>
  fireEvent.keyDown(document.body, { key: 'p', code: 'KeyP', ...init });

/** Press Cmd+P (or the given keys), and let the async reads settle. */
const startPrint = async (init: KeyboardEventInit = { metaKey: true }) => {
  await act(async () => {
    pressPrintShortcut(init);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/** Press Cmd+P, and wait for the page to be handed to the browser. */
const printWhole = async () => {
  await startPrint();
  await waitFor(() => expect(window.print).toHaveBeenCalled());
};

const afterPrint = () =>
  act(() => {
    window.dispatchEvent(new Event('afterprint'));
  });

/** Closes whatever dialog is open: by its Close, OK or Cancel button, else Escape. */
const closeDialog = async () => {
  const dialog = screen.getByRole('dialog');
  const [button] = within(dialog).queryAllByRole('button', {
    name: /^(close|ok|dismiss|cancel)$/i,
  });
  if (button) await userEvent.click(button);
  else await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
};

/** A pending promise, settled by the test. */
const gate = <T,>() => {
  let open!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    open = resolve;
  });
  return { promise, open };
};

// ===================================================================== tests

describe('AC2.3: the progress dialog', () => {
  it('AC2.3 opens a dialog with a progress bar and a Cancel button, counting the rows of every part', async () => {
    const held = gate<unknown>();
    graphql.getWorkGlossaryTerms.mockReset().mockImplementation(async () => {
      await held.promise;
      return termPage(TERMS, null);
    });
    await mount();

    await startPrint();

    const dialog = await screen.findByRole('dialog');
    const bar = within(dialog).getByRole('progressbar');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(bar.getAttribute('aria-valuenow')).not.toBeNull();
    expect(bar.getAttribute('aria-valuemax')).not.toBeNull();
    // Every part is read before the glossary is: the bar has counted them all.
    await waitFor(() =>
      expect(graphql.getWorkGlossaryTerms).toHaveBeenCalled(),
    );
    await waitFor(() => {
      const now = Number(bar.getAttribute('aria-valuenow'));
      const max = Number(bar.getAttribute('aria-valuemax'));
      expect(max).toBe(VISIBLE_ROWS);
      expect(now).toBe(VISIBLE_ROWS);
    });
    held.open(null);
    await waitFor(() => expect(window.print).toHaveBeenCalled());
  });
});

describe('AC2.4: what it reads, and in what order', () => {
  it('AC2.4 reads every glossary term of the work after the parts, paging forward until hasMoreAfter is false', async () => {
    await mount();

    await printWhole();

    const calls = graphql.getWorkGlossaryTerms.mock.calls.map(
      ([args]) => args as { uuid: string; cursor?: string; direction?: string },
    );
    expect(calls.map((args) => args.cursor)).toEqual([undefined, 'c1', 'c2']);
    calls.forEach((args) => {
      expect(args.uuid).toBe(WORK);
      expect(args.direction === undefined || args.direction === 'forward').toBe(
        true,
      );
    });
    // Not before the last part had been read.
    finishedAtGlossary.forEach((done) => expect(done).toEqual(PARTS));
    expect(reads.every((read) => read.glossaryReads === 0)).toBe(true);
  });

  it('AC2.4 reads only the parts the provider has', async () => {
    // A work with no bibliography seeded.
    const { bibliography: _omitted, ...withoutBibliography } =
      seed as unknown as {
        bibliography: unknown;
      } & StackReaderSeed;
    void _omitted;
    render(
      <StackReaderProvider workUuid={WORK} seed={withoutBibliography}>
        <NavigationProvider uuid={WORK} initialToh="toh145">
          <StackPrint>
            <span>page content</span>
          </StackPrint>
        </NavigationProvider>
      </StackReaderProvider>,
    );

    await printWhole();

    expect(reads.map((read) => read.tab)).toEqual(PARTS.slice(0, 4));
    expect(printed[0].text).not.toContain('bib entry');
  });
});

describe('AC2.5: the printable page', () => {
  it('AC2.5 holds the English title, every row of each part in order, then a Glossary section of every term in the order read', async () => {
    await mount();

    await printWhole();

    const { text, headings } = printed[0];
    expect(headings).toContain(TITLE);
    const order = [TITLE, ...ROW_TEXT, 'Glossary', ...TERMS];
    const positions = order.map((needle) => text.indexOf(needle));
    order.forEach((needle, i) =>
      expect([needle, positions[i]]).not.toEqual([needle, -1]),
    );
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // The title is a heading, ahead of everything else it holds.
    expect(headings[0]).toBe(TITLE);
    expect(headings).toContain('Glossary');
  });

  it('AC2.5 holds each row’s static HTML, as the view gives it', async () => {
    await mount();

    await printWhole();

    const shown: [string, string][] = [
      ['front', 'front-0'],
      ['front', 'front-1'],
      ['translation', 'translation-0'],
      ['translation', 'translation-2'],
      ['translation', 'translation-3'],
      ['abbreviations', 'abbreviations-0'],
      ['endnotes', 'endnotes-0'],
      ['endnotes', 'endnotes-1'],
      ['bibliography', 'b-1-1'],
      ['bibliography', 'b-1-2'],
      ['bibliography', 'b-2-1'],
    ];
    expect(shown).toHaveLength(ROW_TEXT.length);
    shown.forEach(([tab, uuid]) => {
      const html = controllers[tab]?.getStaticHTML(uuid);
      expect(html).toBeTruthy();
      expect(printed[0].html).toContain(html);
    });
    expect(printed[0].html).not.toContain(
      controllers.translation?.getStaticHTML('translation-1') ?? 'absent',
    );
  });

  it('AC2.5 prints without a title when navigation has no imprint', async () => {
    graphql.getTranslationImprint.mockReset().mockResolvedValue(undefined);

    await mount();
    await printWhole();

    expect(printed[0].text).toContain('front 0 text');
    expect(printed[0].text).toContain('Term epsilon');
    expect(printed[0].text).not.toContain(TITLE);
  });
});

describe('AC2.6: after printing', () => {
  it('AC2.6 a second print after the first starts a fresh session', async () => {
    await mount();
    await printWhole();
    afterPrint();
    await waitFor(() => expect(printElements()).toHaveLength(0));

    await startPrint();

    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(2));
    expect(printElements()).toHaveLength(1);
    expect(printed[1].text).toContain('Term epsilon');
  });
});

describe('AC2.7: Cancel during loading', () => {
  it('AC2.7 cancelling while the glossary loads closes the dialog and never prints', async () => {
    const held = gate<null>();
    graphql.getWorkGlossaryTerms.mockReset().mockImplementation(async () => {
      await held.promise;
      return termPage(TERMS, null);
    });
    await mount();

    await startPrint();
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(graphql.getWorkGlossaryTerms).toHaveBeenCalled(),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    held.open(null);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(window.print).not.toHaveBeenCalled();
    expect(printElements()).toHaveLength(0);
  });
});

describe('AC2.8: a part that cannot be read', () => {
  it('AC2.8 says it could not load, does not print, and leaves no print element once closed, when a later glossary page comes back empty', async () => {
    graphql.getWorkGlossaryTerms
      .mockReset()
      .mockImplementation(async ({ cursor }: { cursor?: string }) =>
        cursor
          ? {
              terms: [],
              hasMoreAfter: false,
              hasMoreBefore: false,
              totalCount: 0,
            }
          : termPage(TERMS.slice(0, 2), { cursor: 'c1' }),
      );
    await mount();

    await startPrint();

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.textContent).toMatch(/could not load/i));
    expect(window.print).not.toHaveBeenCalled();
    await closeDialog();
    expect(printElements()).toHaveLength(0);
    expect(window.print).not.toHaveBeenCalled();
  });

  it('AC2.8 a first glossary page that is empty because the work has no glossary still prints', async () => {
    graphql.getWorkGlossaryTerms.mockReset().mockResolvedValue({
      terms: [],
      hasMoreAfter: false,
      hasMoreBefore: false,
      totalCount: 0,
    });
    await mount();

    await printWhole();

    expect(printed[0].text).toContain('front 0 text');
    expect(screen.queryByText(/could not load/i)).toBeNull();
  });
});

describe('AC2.11: every part is read for the Toh being read', () => {
  it('AC2.11 reads the other Toh when navigation is on it', async () => {
    await mount({ toh: 'toh847' });

    await printWhole();

    reads.forEach((read) => expect(read.toh).toBe('toh847'));
    expect(printed[0].text).toContain('translation 1 text');
    expect(printed[0].text).toContain('translation 2 text');
    expect(printed[0].text).not.toContain('translation 0 text');
  });
});

describe('AC2.10: the print stylesheet', () => {
  it('AC2.10 while the print element exists a style holds an @media print rule hiding the other children of body', async () => {
    await mount();

    await printWhole();

    const { styles } = printed[0];
    expect(styles).toContain('@media print');
    expect(styles).toContain('[data-stack-print]');
    const block = styles.slice(styles.indexOf('@media print'));
    const end = styles.indexOf('@media screen');
    const printRules =
      end > styles.indexOf('@media print')
        ? block.slice(0, end - styles.indexOf('@media print'))
        : block;
    expect(printRules).toMatch(/body/);
    expect(printRules).toMatch(/none/);
    expect(printRules).toContain('[data-stack-print]');
  });
});
