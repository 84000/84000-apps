/**
 * Acceptance tests for DEV-884, the glossary entry panel, written from the
 * issue's criteria. They drive the panel through its public props, a fake
 * stack controller and an in-memory stand-in for `saveGlossaryEntry` that
 * applies DEV-880's guard (`expect` must match what is stored).
 */
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

import type {
  GlossaryAuthority,
  GlossaryEntry,
  GlossaryEntryName,
} from '@eightyfourthousand/data-access';

type SavedCall = {
  before: GlossaryEntry;
  after: Record<string, unknown>;
  change: Record<string, unknown>;
};

const mockApi = {
  stored: null as GlossaryEntry | null,
  saves: [] as SavedCall[],
  shared: new Set<string>(),
  authorities: new Map<string, GlossaryAuthority>(),
  results: [] as unknown[],
  counter: 0,
};

jest.mock('@eightyfourthousand/data-access', () => {
  const actual = jest.requireActual('@eightyfourthousand/data-access');
  const key = (n: Record<string, unknown>) =>
    JSON.stringify([
      n['glossaryUuid'] ?? null,
      n['nameUuid'] ?? null,
      n['language'] ?? null,
      n['content'] ?? null,
      n['contentTransformed'] ?? null,
      n['termType'] ?? null,
      n['attestation'] ?? null,
    ]);
  const sameValue = (field: string, a: unknown, b: unknown) => {
    if (field === 'names') {
      const ka = (a as Record<string, unknown>[]).map(key).sort();
      const kb = (b as Record<string, unknown>[]).map(key).sort();
      return JSON.stringify(ka) === JSON.stringify(kb);
    }
    return (a ?? null) === (b ?? null);
  };
  const ok = (entry: unknown) => ({
    success: true,
    dryRun: false,
    entries: [entry],
    deleted: [],
    changes: {},
  });
  return {
    ...actual,
    createBrowserClient: () => ({}),
    getGlossaryEntrySharedNames: jest.fn(async () => mockApi.shared),
    getGlossaryEntry: jest.fn(async () =>
      mockApi.stored
        ? { status: 'found', entry: mockApi.stored }
        : { status: 'not-found' },
    ),
    getGlossaryAuthorities: jest.fn(async ({ uuids }: { uuids: string[] }) =>
      uuids.flatMap((u) => {
        const found = mockApi.authorities.get(u);
        return found ? [found] : [];
      }),
    ),
    searchGlossaryAuthorities: jest.fn(async () => mockApi.results),
    saveGlossaryEntry: jest.fn(
      async ({
        before,
        after,
      }: {
        before: GlossaryEntry;
        after: Record<string, unknown>;
      }) => {
        const { change, expect: guard } = actual.glossaryEntryChange(
          before,
          after,
        );
        mockApi.saves.push({ before, after, change });
        const stored = mockApi.stored as unknown as Record<string, unknown>;
        if (!Object.keys(change).length) return ok(stored);
        for (const field of Object.keys(guard)) {
          if (!sameValue(field, guard[field], stored[field])) {
            return {
              success: false,
              reason: 'stale',
              error: 'changed elsewhere',
              outcomeUnknown: false,
            };
          }
        }
        const next: Record<string, unknown> = { ...stored };
        for (const field of Object.keys(change)) {
          if (field === 'names') {
            const names = (change['names'] as Record<string, unknown>[]).map(
              (n) => ({
                glossaryUuid: n['glossaryUuid'] ?? `new-g-${++mockApi.counter}`,
                nameUuid: n['nameUuid'] ?? `new-n-${++mockApi.counter}`,
                nameAuthorityUuid:
                  n['nameAuthorityUuid'] ?? before.authorityUuid,
                language: n['language'] ?? null,
                content: n['content'],
                contentTransformed: n['contentTransformed'] ?? null,
                termType: n['termType'] ?? null,
                attestation: n['attestation'] ?? null,
              }),
            );
            // The read puts the root first.
            names.sort(
              (a, b) =>
                Number(b.glossaryUuid === before.uuid) -
                Number(a.glossaryUuid === before.uuid),
            );
            next['names'] = names;
          } else {
            next[field] = change[field];
          }
        }
        mockApi.stored = next as unknown as GlossaryEntry;
        return ok(mockApi.stored);
      },
    ),
  };
});

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  GLOSSARY_ATTESTATIONS,
  GLOSSARY_DEFINITION_RENDS,
  termDefinition,
} from '@eightyfourthousand/data-access';
import { htmlToText } from '@eightyfourthousand/lib-utils';

import {
  DEFINITION_REND_CHOICES,
  GLOSSARY_MODE_CHOICES,
  GlossaryEntryPanel,
} from './GlossaryEntryPanel';
import type { StackController } from './StackController';
import { openGlossaryEntryPanel } from './glossary-entry-panel';
import {
  GlossaryTibetanProvider,
  type TibetanToWylie,
} from './glossary-tibetan';

// ---------------------------------------------------------------- fixtures

/** A stack controller as far as the panel can see one. */
class FakeStack {
  entries = new Map<string, GlossaryEntry>();
  focused: string | null = null;
  version = 0;
  listeners = new Set<() => void>();
  constructor(
    entries: GlossaryEntry[],
    private readOnly = false,
  ) {
    entries.forEach((e) => this.entries.set(e.uuid, e));
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getVersion = () => this.version;
  getFocusedUuid = () => this.focused;
  getGlossaryEntry = (uuid: string) => this.entries.get(uuid) ?? null;
  getGlossary = () => null;
  getMeta = (uuid: string) => ({ uuid, label: 'g.1', type: 'glossary' });
  isReadOnly = () => this.readOnly;
  settleGlossaryEntry = (uuid: string, entry: GlossaryEntry) => {
    const held = this.entries.get(uuid);
    if (!held) return;
    this.entries.set(uuid, { ...entry, definition: held.definition });
    this.bump();
  };
  focus(uuid: string | null) {
    this.focused = uuid;
    this.bump();
  }
  private bump() {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }
}

const asController = (stack: FakeStack) => stack as unknown as StackController;

const name = (
  content: string,
  o: Partial<GlossaryEntryName> = {},
): GlossaryEntryName => ({
  glossaryUuid: `g-${content}`,
  nameUuid: `n-${content}`,
  nameAuthorityUuid: 'auth-1',
  language: 'en',
  content,
  contentTransformed: null,
  termType: null,
  attestation: null,
  ...o,
});

const MAIN = (content = 'awakening mind', o: Partial<GlossaryEntryName> = {}) =>
  name(content, {
    glossaryUuid: 'e1',
    termType: 'translationMain',
    ...o,
  });
const ALT = (content: string, o: Partial<GlossaryEntryName> = {}) =>
  name(content, { termType: 'translationAlternative', ...o });
const BO = (
  wylie: string,
  script: string,
  o: Partial<GlossaryEntryName> = {},
) => name(wylie, { language: 'Bo-Ltn', contentTransformed: script, ...o });
const SA = (content: string, o: Partial<GlossaryEntryName> = {}) =>
  name(content, { language: 'Sa-Ltn', ...o });
const PI = (content: string, o: Partial<GlossaryEntryName> = {}) =>
  name(content, { language: 'Pi-Ltn', ...o });
const ZH = (content: string, o: Partial<GlossaryEntryName> = {}) =>
  name(content, { language: 'zh', ...o });

const ENTRY_DEFINITION = '<p>ENTRYDEF mine.</p>';
const STANDARD_DEFINITION = '<p>STANDARD theirs.</p>';

const makeEntry = (
  names: GlossaryEntryName[],
  o: Partial<GlossaryEntry> = {},
): GlossaryEntry => ({
  uuid: 'e1',
  workUuid: 'w1',
  authorityUuid: 'auth-1',
  definition: ENTRY_DEFINITION,
  definitionRend: null,
  glossMode: 'match',
  names,
  ...o,
});

const authority = (
  uuid: string,
  headword: string,
  o: Partial<GlossaryAuthority> = {},
): GlossaryAuthority => ({
  uuid,
  headword,
  headwordLanguage: 'Sa-Ltn',
  definition: STANDARD_DEFINITION,
  names: [],
  ...o,
});

/** Script containing ཁ gets a warning; every script gets a `w(…)` Wylie. */
const toWylie: TibetanToWylie = jest.fn((script: string) => ({
  ewts: `w(${script})`,
  warnings: script.includes('ཁ') ? ['check the stack near ཁ'] : [],
}));

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

type Options = {
  readOnly?: boolean;
  tibetan?: boolean;
  shared?: string[];
  authorities?: GlossaryAuthority[];
};

const start = async (entry: GlossaryEntry, o: Options = {}) => {
  mockApi.stored = entry;
  mockApi.shared = new Set(o.shared ?? []);
  mockApi.authorities = new Map(
    (
      o.authorities ?? [
        authority('auth-1', 'Bodhicitta'),
        authority('auth-2', 'Prajna'),
      ]
    ).map((a) => [a.uuid, a]),
  );
  const stack = new FakeStack([entry], o.readOnly);
  const controller = asController(stack);
  const ui = (
    <GlossaryTibetanProvider toWylie={toWylie}>
      <GlossaryEntryPanel controller={controller} />
    </GlossaryTibetanProvider>
  );
  const bare = <GlossaryEntryPanel controller={controller} />;
  const view = render(o.tibetan === false ? bare : ui);
  await act(async () => {
    openGlossaryEntryPanel(controller, entry.uuid);
  });
  await screen.findByRole('dialog');
  await settle();
  return { stack, controller, user: userEvent.setup(), view };
};

const dialog = () => screen.getByRole('dialog');
const section = (heading: string | RegExp) => {
  const found = within(dialog())
    .getByRole('heading', { name: heading })
    .closest('section');
  if (!found) throw new Error(`no section for ${String(heading)}`);
  return found as HTMLElement;
};
const itemOf = (text: string, scope: HTMLElement = dialog()) => {
  const found = within(scope).getByText(text).closest('li');
  if (!found) throw new Error(`no list item for ${text}`);
  return found as HTMLElement;
};
const button = (scope: HTMLElement, label: string | RegExp) =>
  within(scope).getByRole('button', { name: label });
const maybeButton = (scope: HTMLElement, label: string | RegExp) =>
  within(scope).queryByRole('button', { name: label });

const writes = () =>
  mockApi.saves.filter((s) => Object.keys(s.change).length > 0);
const lastWrite = () => {
  const all = writes();
  if (!all.length) throw new Error('nothing was saved');
  return all[all.length - 1];
};

type PlainName = {
  language: unknown;
  content: unknown;
  contentTransformed: unknown;
  termType: unknown;
  attestation: unknown;
};
const plain = (names: unknown): PlainName[] =>
  (names as Record<string, unknown>[]).map((n) => ({
    language: n['language'] ?? null,
    content: n['content'],
    contentTransformed: n['contentTransformed'] ?? null,
    termType: n['termType'] ?? null,
    attestation: n['attestation'] ?? null,
  }));
const savedNames = () => plain(lastWrite().change['names']);
const storedNames = () => plain(mockApi.stored?.names ?? []);
const find = (names: PlainName[], content: string) =>
  names.find((n) => n.content === content);

const fieldset = (legend: string | RegExp) =>
  within(dialog()).getByRole('group', { name: legend });
const radio = (scope: HTMLElement, label: string | RegExp) =>
  within(scope).getByRole('radio', { name: label }) as HTMLInputElement;

beforeEach(() => {
  mockApi.stored = null;
  mockApi.saves = [];
  mockApi.shared = new Set();
  mockApi.authorities = new Map();
  mockApi.results = [];
  mockApi.counter = 0;
  (toWylie as jest.Mock).mockClear();
});

const BASE = () => [
  MAIN(),
  ALT('enlightened mind'),
  BO('byang chub sems', 'བྱང་ཆུབ་སེམས', { attestation: 'attestedSource' }),
  SA('bodhicitta'),
];

// ------------------------------------------------------------------- AC 1

describe('[AC1] opening and following the selected row', () => {
  it('[AC1] shows no panel until it is opened, then the entry', async () => {
    const entry = makeEntry(BASE());
    const stack = new FakeStack([entry]);
    const controller = asController(stack);
    render(<GlossaryEntryPanel controller={controller} />);
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => {
      openGlossaryEntryPanel(controller, 'e1');
    });
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(dialog().textContent).toContain('awakening mind');
  });

  it('[AC1] switches to the entry of another selected row while open', async () => {
    const first = makeEntry(BASE());
    const second = makeEntry([MAIN('emptiness', { glossaryUuid: 'e2' })], {
      uuid: 'e2',
    });
    mockApi.stored = first;
    mockApi.authorities = new Map([
      ['auth-1', authority('auth-1', 'Bodhicitta')],
    ]);
    const stack = new FakeStack([first, second]);
    const controller = asController(stack);
    render(<GlossaryEntryPanel controller={controller} />);
    await act(async () => {
      openGlossaryEntryPanel(controller, 'e1');
    });
    await settle();
    expect(dialog().textContent).toContain('awakening mind');
    await act(async () => {
      stack.focus('e2');
    });
    await settle();
    expect(dialog().textContent).toContain('emptiness');
    expect(dialog().textContent).not.toContain('awakening mind');
  });

  it('[AC1] does not open on its own when a row is selected while closed', async () => {
    const entry = makeEntry(BASE());
    const stack = new FakeStack([entry]);
    const controller = asController(stack);
    render(<GlossaryEntryPanel controller={controller} />);
    await settle();
    await act(async () => {
      stack.focus('e1');
    });
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('[AC1] closes from its close control', async () => {
    const { user } = await start(makeEntry(BASE()));
    await user.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

// ------------------------------------------------------------------- AC 2

describe('[AC2] read-only without editor.edit', () => {
  it('[AC2] shows every value and offers no control to change one', async () => {
    await start(
      makeEntry(
        [
          ...BASE(),
          PI('bodhicitta-pi'),
          ZH('菩提心'),
          name('ko name', { language: 'Ko-Ltn' }),
        ],
        { definitionRend: 'appendWithStandard', glossMode: 'marked' },
      ),
      { readOnly: true },
    );
    const text = dialog().textContent ?? '';
    for (const shown of [
      'awakening mind',
      'enlightened mind',
      'byang chub sems',
      'བྱང་ཆུབ་སེམས',
      'bodhicitta',
      '菩提心',
      'Bodhicitta',
      'STANDARD theirs.',
    ]) {
      expect(text).toContain(shown);
    }
    // Chosen values show as text, with what the panel offered for them.
    expect(text).toContain('Append the standard');
    expect(text).toContain('Marked');
    expect(text).toContain('Attested Source');
    expect(text).toContain('ENTRYDEF mine.');

    const controls = Array.from(
      dialog().querySelectorAll<HTMLElement>('button, input, select, textarea'),
    ).filter(
      (el) =>
        !(el as HTMLButtonElement).disabled &&
        !/close/i.test(el.textContent ?? '') &&
        !/close/i.test(el.getAttribute('aria-label') ?? ''),
    );
    expect(controls.map((el) => el.outerHTML.slice(0, 80))).toEqual([]);
  });

  it('[AC2] makes no save when a read-only user clicks the values', async () => {
    const { user } = await start(makeEntry(BASE()), { readOnly: true });
    for (const r of within(dialog()).queryAllByRole('radio')) {
      await user.click(r);
    }
    await settle();
    expect(writes()).toEqual([]);
  });
});

// ------------------------------------------------------------------- AC 3

describe('[AC3] names grouped by language', () => {
  const entry = () =>
    makeEntry([
      MAIN('awakening mind'),
      ALT('gamma mind'),
      ALT('alpha mind'),
      ALT('beta mind'),
      BO('khu', 'ཁུ'),
      BO('ka', 'ཀ'),
      BO('kha', 'ཁ'),
      SA('sutra'),
      SA('bodhi'),
      SA('citta'),
      PI('pali-c'),
      PI('pali-a'),
      ZH('丙'),
      ZH('甲'),
      ZH('乙'),
    ]);

  const order = (scope: HTMLElement, texts: string[]) => {
    const html = scope.textContent ?? '';
    const at = texts.map((t) => html.indexOf(t));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  };

  it('[AC3] has a group for the main name, alternatives, Tibetan, Sanskrit, Pali and Chinese', async () => {
    await start(entry());
    const headings = within(dialog())
      .getAllByRole('heading', { level: 4 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      'Main English name',
      'English alternatives',
      'Tibetan',
      'Sanskrit',
      'Pali',
      'Chinese',
    ]);
  });

  it('[AC3] puts each name in its own group', async () => {
    await start(entry());
    expect(section('Main English name').textContent).toContain(
      'awakening mind',
    );
    expect(section('Main English name').textContent).not.toContain(
      'alpha mind',
    );
    expect(section('English alternatives').textContent).toContain('alpha mind');
    expect(section('Tibetan').textContent).toContain('ka');
    expect(section('Sanskrit').textContent).toContain('bodhi');
    expect(section('Pali').textContent).toContain('pali-a');
    expect(section('Chinese').textContent).toContain('甲');
  });

  it('[AC3] lists names alphabetically within each group', async () => {
    await start(entry());
    order(section('English alternatives'), [
      'alpha mind',
      'beta mind',
      'gamma mind',
    ]);
    order(section('Tibetan'), ['ka', 'kha', 'khu']);
    order(section('Sanskrit'), ['bodhi', 'citta', 'sutra']);
    order(section('Pali'), ['pali-a', 'pali-c']);
    order(section('Chinese'), ['乙', '丙', '甲'].sort());
  });

  it('[AC3] shows both the script and the Wylie of a Tibetan name', async () => {
    await start(entry());
    const item = itemOf('ka', section('Tibetan'));
    expect(item.textContent).toContain('ཀ');
    expect(item.textContent).toContain('ka');
  });
});

// ------------------------------------------------------------------- AC 4

describe('[AC4] main English name', () => {
  it('[AC4] can be edited', async () => {
    const { user } = await start(makeEntry(BASE()));
    const main = section('Main English name');
    await user.click(button(main, /edit/i));
    const input = within(main).getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'awakened mind');
    await user.click(button(main, /save/i));
    await settle();
    const names = savedNames();
    expect(find(names, 'awakened mind')).toMatchObject({
      language: 'en',
      termType: 'translationMain',
    });
    expect(find(names, 'awakening mind')).toBeUndefined();
    expect(
      names.filter(
        (n) => n.language === 'en' && n.termType === 'translationMain',
      ),
    ).toHaveLength(1);
    expect(section('Main English name').textContent).toContain('awakened mind');
  });

  it('[AC4] offers no way to remove it', async () => {
    await start(makeEntry(BASE()));
    expect(
      maybeButton(section('Main English name'), /remove|delete/i),
    ).toBeNull();
  });

  it('[AC4] never ends up without a main name, even when it is emptied', async () => {
    const { user } = await start(makeEntry(BASE()));
    const main = section('Main English name');
    await user.click(button(main, /edit/i));
    await user.clear(within(main).getByRole('textbox'));
    const save = maybeButton(main, /save/i);
    if (save && !(save as HTMLButtonElement).disabled) await user.click(save);
    await settle();
    const mains = storedNames().filter(
      (n) => n.language === 'en' && n.termType === 'translationMain',
    );
    expect(mains).toHaveLength(1);
    expect(String(mains[0].content).trim()).not.toBe('');
  });

  it('[AC4] has exactly one main name after other changes', async () => {
    const { user } = await start(makeEntry(BASE()));
    await user.click(button(section('English alternatives'), /add/i));
    await user.type(
      within(section('English alternatives')).getByRole('textbox'),
      'new alt',
    );
    await user.click(button(section('English alternatives'), /^add$/i));
    await settle();
    expect(
      savedNames().filter((n) => n.termType === 'translationMain'),
    ).toHaveLength(1);
  });
});

// ------------------------------------------------------------------- AC 5

describe('[AC5] adding and removing names', () => {
  it('[AC5] adds an English alternative', async () => {
    const { user } = await start(makeEntry(BASE()));
    const alts = section('English alternatives');
    await user.click(button(alts, /add/i));
    await user.type(within(alts).getByRole('textbox'), 'bodhi mind');
    await user.click(button(alts, /^add$/i));
    await settle();
    expect(find(savedNames(), 'bodhi mind')).toMatchObject({
      language: 'en',
      termType: 'translationAlternative',
      attestation: null,
    });
    expect(section('English alternatives').textContent).toContain('bodhi mind');
  });

  it.each([
    ['Sanskrit', 'Sa-Ltn', 'a new sanskrit'],
    ['Pali', 'Pi-Ltn', 'a new pali'],
    ['Chinese', 'zh', '新名'],
  ])('[AC5] adds a %s name', async (group, language, text) => {
    const { user } = await start(makeEntry(BASE()));
    const scope = section(group);
    await user.click(button(scope, /add/i));
    await user.type(within(scope).getByRole('textbox'), text);
    await user.click(button(scope, /^add$/i));
    await settle();
    expect(find(savedNames(), text)).toMatchObject({ language });
    expect(section(group).textContent).toContain(text);
  });

  it('[AC5] adds a Tibetan name', async () => {
    const { user } = await start(makeEntry(BASE()));
    const scope = section('Tibetan');
    await user.click(button(scope, /add/i));
    await user.type(within(scope).getByRole('textbox'), 'ཀཀ');
    await user.click(button(scope, /^add$/i));
    await settle();
    expect(find(savedNames(), 'w(ཀཀ)')).toMatchObject({ language: 'Bo-Ltn' });
  });

  it.each([
    ['English alternatives', 'enlightened mind', 'en'],
    ['Tibetan', 'byang chub sems', 'Bo-Ltn'],
    ['Sanskrit', 'bodhicitta', 'Sa-Ltn'],
    ['Pali', 'pali one', 'Pi-Ltn'],
    ['Chinese', '菩提心', 'zh'],
  ])('[AC5] removes a name from %s', async (group, content) => {
    const { user } = await start(
      makeEntry([...BASE(), PI('pali one'), ZH('菩提心')]),
    );
    await user.click(button(itemOf(content, section(group)), /remove/i));
    await settle();
    expect(find(savedNames(), content)).toBeUndefined();
    // The rest of the entry is kept.
    expect(find(savedNames(), 'awakening mind')).toBeDefined();
    expect(section(group).textContent).not.toContain(content);
  });

  it.each([
    ['English alternatives', 'enlightened mind', 'a'],
    ['Sanskrit', 'bodhicitta', 'a'],
    ['Pali', 'pali one', 'a'],
    ['Chinese', '菩提心', 'a'],
  ])(
    '[AC5] refuses a duplicate in %s, with a message',
    async (group, existing) => {
      const { user } = await start(
        makeEntry([...BASE(), PI('pali one'), ZH('菩提心')]),
      );
      const scope = section(group);
      await user.click(button(scope, /add/i));
      await user.type(within(scope).getByRole('textbox'), existing);
      await user.click(button(scope, /^add$/i));
      await settle();
      expect(writes()).toEqual([]);
      expect(dialog().textContent).toMatch(/already|duplicate|same|exists/i);
    },
  );

  it('[AC5] refuses a Tibetan name whose script is already there', async () => {
    const { user } = await start(makeEntry(BASE()));
    const scope = section('Tibetan');
    await user.click(button(scope, /add/i));
    await user.type(within(scope).getByRole('textbox'), 'བྱང་ཆུབ་སེམས');
    await user.click(button(scope, /^add$/i));
    await settle();
    expect(writes().filter((w) => plain(w.change['names']).length > 4)).toEqual(
      [],
    );
    expect(dialog().textContent).toMatch(/already|duplicate|same|exists/i);
  });

  it('[AC5] allows the same text in a different group', async () => {
    const { user } = await start(makeEntry(BASE()));
    const scope = section('Pali');
    await user.click(button(scope, /add/i));
    await user.type(within(scope).getByRole('textbox'), 'bodhicitta');
    await user.click(button(scope, /^add$/i));
    await settle();
    expect(savedNames().filter((n) => n.content === 'bodhicitta')).toHaveLength(
      2,
    );
  });
});

// ------------------------------------------------------------------- AC 6

describe('[AC6] Tibetan entered as script', () => {
  it('[AC6] generates the Wylie from the script and shows it before saving', async () => {
    const { user } = await start(makeEntry(BASE()));
    const scope = section('Tibetan');
    await user.click(button(scope, /add/i));
    await user.type(within(scope).getByRole('textbox'), 'ཀཀ');
    await settle();
    expect(toWylie).toHaveBeenCalledWith(expect.stringContaining('ཀཀ'));
    expect(scope.textContent).toContain('w(ཀཀ)');
    expect(writes()).toEqual([]);
  });

  it('[AC6] stores the Wylie as the content and the script beside it', async () => {
    const { user } = await start(makeEntry(BASE()));
    const scope = section('Tibetan');
    await user.click(button(scope, /add/i));
    await user.type(within(scope).getByRole('textbox'), 'ཀཀ');
    await user.click(button(scope, /^add$/i));
    await settle();
    expect(find(savedNames(), 'w(ཀཀ)')).toMatchObject({
      language: 'Bo-Ltn',
      contentTransformed: 'ཀཀ',
    });
    const item = itemOf('w(ཀཀ)', section('Tibetan'));
    expect(item.textContent).toContain('ཀཀ');
  });

  it('[AC6] shows conversion warnings next to the name, and still saves it', async () => {
    const { user } = await start(makeEntry(BASE()));
    const scope = section('Tibetan');
    await user.click(button(scope, /add/i));
    await user.type(within(scope).getByRole('textbox'), 'ཁཁ');
    await settle();
    expect(scope.textContent).toContain('check the stack near ཁ');
    await user.click(button(scope, /^add$/i));
    await settle();
    expect(find(savedNames(), 'w(ཁཁ)')).toMatchObject({
      contentTransformed: 'ཁཁ',
    });
  });

  it('[AC6] shows no warning when the conversion reports none', async () => {
    const { user } = await start(makeEntry(BASE()));
    const scope = section('Tibetan');
    await user.click(button(scope, /add/i));
    await user.type(within(scope).getByRole('textbox'), 'ཀཀ');
    await settle();
    expect(scope.textContent).not.toContain('check the stack');
  });

  it('[AC6] regenerates the Wylie when a Tibetan name is edited', async () => {
    const { user } = await start(makeEntry(BASE()));
    const scope = section('Tibetan');
    await user.click(button(itemOf('byang chub sems', scope), /edit/i));
    const input = within(scope).getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'གག');
    await settle();
    expect(scope.textContent).toContain('w(གག)');
    await user.click(button(scope, /save/i));
    await settle();
    expect(find(savedNames(), 'w(གག)')).toMatchObject({
      language: 'Bo-Ltn',
      contentTransformed: 'གག',
    });
    expect(find(savedNames(), 'byang chub sems')).toBeUndefined();
  });
});

// ------------------------------------------------------------------- AC 7

describe('[AC7] attestation', () => {
  const full = () =>
    makeEntry([
      ...BASE(),
      PI('pali one'),
      ZH('菩提心', { attestation: 'attestedDictionary' }),
    ]);

  it.each([
    ['Tibetan', 'byang chub sems'],
    ['Sanskrit', 'bodhicitta'],
    ['Pali', 'pali one'],
    ['Chinese', '菩提心'],
  ])(
    '[AC7] offers the fixed list or none on a %s name',
    async (group, content) => {
      await start(full());
      const select = within(itemOf(content, section(group))).getByRole(
        'combobox',
      );
      const options = within(select).getAllByRole(
        'option',
      ) as HTMLOptionElement[];
      expect(options).toHaveLength(GLOSSARY_ATTESTATIONS.length + 1);
      expect(options.map((o) => o.value).sort()).toEqual(
        ['', ...GLOSSARY_ATTESTATIONS].sort(),
      );
    },
  );

  it('[AC7] shows the stored attestation', async () => {
    await start(full());
    const tib = within(itemOf('byang chub sems', section('Tibetan'))).getByRole(
      'combobox',
    ) as HTMLSelectElement;
    const zh = within(itemOf('菩提心', section('Chinese'))).getByRole(
      'combobox',
    ) as HTMLSelectElement;
    const sa = within(itemOf('bodhicitta', section('Sanskrit'))).getByRole(
      'combobox',
    ) as HTMLSelectElement;
    expect([tib.value, zh.value, sa.value]).toEqual([
      'attestedSource',
      'attestedDictionary',
      '',
    ]);
  });

  it('[AC7] sets an attestation on a Sanskrit name and saves it', async () => {
    const { user } = await start(full());
    const select = within(itemOf('bodhicitta', section('Sanskrit'))).getByRole(
      'combobox',
    );
    await user.selectOptions(select, 'reconstructedPhonetic');
    await settle();
    expect(find(savedNames(), 'bodhicitta')).toMatchObject({
      attestation: 'reconstructedPhonetic',
    });
    expect(find(savedNames(), 'byang chub sems')).toMatchObject({
      attestation: 'attestedSource',
    });
  });

  it('[AC7] clears an attestation back to none', async () => {
    const { user } = await start(full());
    const select = within(itemOf('菩提心', section('Chinese'))).getByRole(
      'combobox',
    );
    await user.selectOptions(select, '');
    await settle();
    expect(find(savedNames(), '菩提心')?.attestation ?? null).toBeNull();
  });

  it('[AC7] gives alternatives and the main name no attestation', async () => {
    await start(full());
    expect(
      within(section('Main English name')).queryByRole('combobox'),
    ).toBeNull();
    expect(
      within(section('English alternatives')).queryByRole('combobox'),
    ).toBeNull();
  });

  it('[AC7] saves a new alternative and a new Sanskrit name without an attestation', async () => {
    const { user } = await start(full());
    const alts = section('English alternatives');
    await user.click(button(alts, /add/i));
    await user.type(within(alts).getByRole('textbox'), 'fresh alt');
    await user.click(button(alts, /^add$/i));
    await settle();
    const sa = section('Sanskrit');
    await user.click(button(sa, /add/i));
    await user.type(within(sa).getByRole('textbox'), 'fresh sa');
    await user.click(button(sa, /^add$/i));
    await settle();
    expect(find(storedNames(), 'fresh alt')?.attestation).toBeNull();
    expect(find(storedNames(), 'fresh sa')?.attestation).toBeNull();
  });
});

// ------------------------------------------------------------------- AC 8

describe('[AC8] alternatives are labelled', () => {
  it('[AC8] says readers never see them and that they are for matching and search', async () => {
    await start(makeEntry(BASE()));
    const text = section('English alternatives').textContent ?? '';
    expect(text).toMatch(/readers never see/i);
    expect(text).toMatch(/only for matching and search/i);
  });

  it('[AC8] says it even with no alternatives', async () => {
    await start(makeEntry([MAIN()]));
    expect(section('English alternatives').textContent).toMatch(
      /readers never see/i,
    );
  });
});

// ------------------------------------------------------------------- AC 9

describe('[AC9] shared names', () => {
  const entry = () =>
    makeEntry([
      MAIN(),
      ALT('shared alt', { nameUuid: 'n-shared-alt' }),
      ALT('own alt'),
      SA('shared sa', { nameUuid: 'n-shared-sa' }),
      SA('own sa'),
    ]);
  const shared = ['n-shared-alt', 'n-shared-sa'];

  it('[AC9] marks a shared name as shared and gives it no edit control', async () => {
    await start(entry(), { shared });
    for (const [group, text] of [
      ['English alternatives', 'shared alt'],
      ['Sanskrit', 'shared sa'],
    ]) {
      const item = itemOf(text, section(group));
      expect(item.textContent).toMatch(/shared/i);
      expect(maybeButton(item, /edit/i)).toBeNull();
    }
  });

  it('[AC9] leaves a name used by one entry only editable and unmarked', async () => {
    await start(entry(), { shared });
    for (const [group, text] of [
      ['English alternatives', 'own alt'],
      ['Sanskrit', 'own sa'],
    ]) {
      const item = itemOf(text, section(group));
      expect(item.textContent).not.toMatch(/shared/i);
      expect(maybeButton(item, /edit/i)).not.toBeNull();
    }
  });

  it('[AC9] still removes a shared name from this entry', async () => {
    const { user } = await start(entry(), { shared });
    await user.click(
      button(itemOf('shared alt', section('English alternatives')), /remove/i),
    );
    await settle();
    expect(find(savedNames(), 'shared alt')).toBeUndefined();
    expect(find(savedNames(), 'own alt')).toBeDefined();
  });

  it('[AC9] still changes the attestation of a shared name', async () => {
    const { user } = await start(entry(), { shared });
    const select = within(itemOf('shared sa', section('Sanskrit'))).getByRole(
      'combobox',
    ) as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    await user.selectOptions(select, 'attestedOther');
    await settle();
    expect(find(savedNames(), 'shared sa')).toMatchObject({
      attestation: 'attestedOther',
    });
    expect(find(savedNames(), 'shared sa')?.content).toBe('shared sa');
  });

  it('[AC9] does not let a shared main name be edited', async () => {
    await start(
      makeEntry([MAIN('awakening mind', { nameUuid: 'n-shared-main' })]),
      {
        shared: ['n-shared-main'],
      },
    );
    const main = section('Main English name');
    expect(main.textContent).toMatch(/shared/i);
    expect(maybeButton(main, /edit/i)).toBeNull();
  });
});

// ------------------------------------------------------------------ AC 10

describe('[AC10] names in other languages are kept', () => {
  const entry = () =>
    makeEntry([
      ...BASE(),
      name('xx content', { language: 'Ko-Ltn', glossaryUuid: 'g-ko' }),
    ]);

  it('[AC10] lists the name under its language code', async () => {
    await start(entry());
    const heading = within(dialog())
      .getAllByRole('heading')
      .find((h) => /Ko-Ltn/.test(h.textContent ?? ''));
    expect(heading).toBeDefined();
    expect(heading?.closest('section')?.textContent).toContain('xx content');
  });

  it('[AC10] can be removed but not edited', async () => {
    const { user } = await start(entry());
    const item = itemOf('xx content');
    expect(maybeButton(item, /edit/i)).toBeNull();
    expect(within(item).queryByRole('textbox')).toBeNull();
    await user.click(button(item, /remove/i));
    await settle();
    expect(find(savedNames(), 'xx content')).toBeUndefined();
  });

  it('[AC10] is kept in the list when something else changes', async () => {
    const { user } = await start(entry());
    const alts = section('English alternatives');
    await user.click(button(alts, /add/i));
    await user.type(within(alts).getByRole('textbox'), 'another alt');
    await user.click(button(alts, /^add$/i));
    await settle();
    expect(find(savedNames(), 'xx content')).toMatchObject({
      language: 'Ko-Ltn',
    });
  });

  it('[AC10] never offers to add a name in another language', async () => {
    await start(entry());
    const adds = within(dialog())
      .queryAllByRole('button', { name: /^add/i })
      .map((b) => b.textContent);
    expect(adds).toEqual([
      'Add an alternative',
      'Add a Tibetan name',
      'Add a Sanskrit name',
      'Add a Pali name',
      'Add a Chinese name',
    ]);
  });
});

// ------------------------------------------------------------------ AC 11

describe('[AC11] an entry with no English name', () => {
  const entry = () =>
    makeEntry(
      [
        SA('rootless', { glossaryUuid: 'e1' }),
        BO('byang chub sems', 'བྱང་ཆུབ་སེམས'),
        ALT('stray alt'),
      ].slice(0, 2),
    );

  it('[AC11] opens and shows the root name under its own language', async () => {
    await start(entry());
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(section('Sanskrit').textContent).toContain('rootless');
  });

  it('[AC11] offers every other control for the names', async () => {
    await start(entry());
    const root = itemOf('rootless', section('Sanskrit'));
    expect(maybeButton(root, /edit/i)).not.toBeNull();
    expect(within(root).queryByRole('combobox')).not.toBeNull();
    expect(maybeButton(section('English alternatives'), /add/i)).not.toBeNull();
    expect(maybeButton(section('Pali'), /add/i)).not.toBeNull();
    expect(maybeButton(section('Chinese'), /add/i)).not.toBeNull();
    expect(maybeButton(section('Tibetan'), /add/i)).not.toBeNull();
    expect(within(dialog()).getAllByRole('radio').length).toBeGreaterThan(5);
  });

  it('[AC11] does not offer to add an English main name', async () => {
    await start(entry());
    expect(
      within(dialog()).queryByRole('button', {
        name: /add.*main|main.*english/i,
      }),
    ).toBeNull();
    const heading = within(dialog()).queryByRole('heading', {
      name: 'Main English name',
    });
    if (heading) {
      const group = heading.closest('section') as HTMLElement;
      expect(within(group).queryByRole('button', { name: /add/i })).toBeNull();
      expect(within(group).queryByRole('textbox')).toBeNull();
    }
  });
});

// ------------------------------------------------------------------ AC 12

describe('[AC12] definition relation', () => {
  it('[AC12] offers the four relations and none, each with an explanation', async () => {
    await start(makeEntry(BASE()));
    const group = fieldset(/definition relation/i);
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((r) => r.value).sort()).toEqual(
      ['', ...GLOSSARY_DEFINITION_RENDS].sort(),
    );
    for (const choice of DEFINITION_REND_CHOICES) {
      const label = radio(group, new RegExp(choice.label, 'i')).closest(
        'label',
      );
      expect(label?.textContent).toContain(choice.explanation);
      expect(choice.explanation).not.toMatch(/\n/);
    }
  });

  it('[AC12] checks none for an entry with no relation', async () => {
    await start(makeEntry(BASE(), { definitionRend: null }));
    const checked = within(fieldset(/definition relation/i))
      .getAllByRole('radio')
      .filter((r) => (r as HTMLInputElement).checked) as HTMLInputElement[];
    expect(checked.map((r) => r.value)).toEqual(['']);
  });

  it('[AC12] shows the authority standard definition', async () => {
    await start(makeEntry(BASE()));
    expect(dialog().textContent).toContain('STANDARD theirs.');
  });

  it.each(['', ...GLOSSARY_DEFINITION_RENDS])(
    '[AC12] previews what readers see with %j',
    async (rend) => {
      const { user } = await start(makeEntry(BASE(), { definitionRend: null }));
      const group = fieldset(/definition relation/i);
      const target = within(group)
        .getAllByRole('radio')
        .find(
          (r) => (r as HTMLInputElement).value === rend,
        ) as HTMLInputElement;
      if (!target.checked) await user.click(target);
      await settle();
      const preview = screen.getByText(/what readers will see/i).parentElement
        ?.textContent as string;
      const expected = htmlToText(
        termDefinition(ENTRY_DEFINITION, STANDARD_DEFINITION, rend || null),
      );
      for (const piece of ['ENTRYDEF mine.', 'STANDARD theirs.']) {
        expect(preview.includes(piece)).toBe(expected.includes(piece));
      }
      if (expected.includes('ENTRYDEF') && expected.includes('STANDARD')) {
        expect(preview.indexOf('ENTRYDEF') < preview.indexOf('STANDARD')).toBe(
          expected.indexOf('ENTRYDEF') < expected.indexOf('STANDARD'),
        );
      }
    },
  );

  it('[AC12] saves a chosen relation on its own', async () => {
    const { user } = await start(makeEntry(BASE()));
    await user.click(
      radio(fieldset(/definition relation/i), /override with the standard/i),
    );
    await settle();
    expect(writes()).toHaveLength(1);
    expect(Object.keys(lastWrite().change)).toEqual(['definitionRend']);
    expect(lastWrite().change['definitionRend']).toBe('overrideWithStandard');
  });

  it('[AC12] saves none as no relation', async () => {
    const { user } = await start(
      makeEntry(BASE(), { definitionRend: 'appendWithStandard' }),
    );
    await user.click(radio(fieldset(/definition relation/i), /^none/i));
    await settle();
    expect(lastWrite().change['definitionRend'] ?? null).toBeNull();
    expect(Object.keys(lastWrite().change)).toEqual(['definitionRend']);
  });
});

// ------------------------------------------------------------------ AC 13

describe('[AC13] matching mode', () => {
  it('[AC13] offers match and marked, each with an explanation', async () => {
    await start(makeEntry(BASE()));
    const group = fieldset(/matching mode/i);
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((r) => r.value).sort()).toEqual(['marked', 'match']);
    for (const choice of GLOSSARY_MODE_CHOICES) {
      const label = radio(group, new RegExp(`^${choice.label}`, 'i')).closest(
        'label',
      );
      expect(label?.textContent).toContain(choice.explanation);
    }
  });

  it('[AC13] shows match for an entry stored with match', async () => {
    await start(makeEntry(BASE(), { glossMode: 'match' }));
    expect(radio(fieldset(/matching mode/i), /^match/i).checked).toBe(true);
    expect(radio(fieldset(/matching mode/i), /^marked/i).checked).toBe(false);
  });

  it('[AC13] shows marked for a marked entry', async () => {
    await start(makeEntry(BASE(), { glossMode: 'marked' }));
    expect(radio(fieldset(/matching mode/i), /^marked/i).checked).toBe(true);
  });

  it('[AC13] saves a changed mode on its own', async () => {
    const { user } = await start(makeEntry(BASE()));
    await user.click(radio(fieldset(/matching mode/i), /^marked/i));
    await settle();
    expect(writes()).toHaveLength(1);
    expect(Object.keys(lastWrite().change)).toEqual(['glossMode']);
    expect(lastWrite().change['glossMode']).toBe('marked');
    expect(radio(fieldset(/matching mode/i), /^marked/i).checked).toBe(true);
  });

  it('[AC13] does not save an entry stored with no mode just for showing match', async () => {
    await start(makeEntry(BASE(), { glossMode: null as unknown as string }));
    await settle();
    expect(writes()).toEqual([]);
  });
});

// ------------------------------------------------------------------ AC 14

describe('[AC14] linked authority', () => {
  it('[AC14] shows the headword, its language and the standard definition', async () => {
    await start(makeEntry(BASE()), {
      authorities: [
        authority('auth-1', 'Bodhicitta', { headwordLanguage: 'Sa-Ltn' }),
      ],
    });
    const text = dialog().textContent ?? '';
    expect(text).toContain('Bodhicitta');
    expect(text).toContain('Sanskrit');
    expect(text).toContain('STANDARD theirs.');
  });

  it('[AC14] shows a Tibetan headword language', async () => {
    await start(makeEntry(BASE()), {
      authorities: [
        authority('auth-1', 'byang chub sems', { headwordLanguage: 'Bo-Ltn' }),
      ],
    });
    expect(dialog().textContent).toContain('Tibetan');
  });

  it('[AC14] shows the linked authority of the entry shown', async () => {
    await start(makeEntry(BASE(), { authorityUuid: 'auth-2' }));
    expect(dialog().textContent).toContain('Prajna');
    expect(dialog().textContent).not.toContain('Bodhicitta');
  });
});

// --------------------------------------------------------------- AC 15-17

const hit = (
  uuid: string,
  headword: string,
  o: Partial<GlossaryAuthority> = {},
) => ({
  ...authority(uuid, headword, o),
  matchedName: null,
});

const startLinking = async (o: Options = {}) => {
  mockApi.results = [
    hit('auth-2', 'Prajna', { definition: '<p>Standard of Prajna.</p>' }),
  ];
  const ctx = await start(makeEntry(BASE()), o);
  await ctx.user.click(
    screen.getByRole('button', { name: /link another authority|link|change/i }),
  );
  await ctx.user.type(screen.getByRole('searchbox'), 'praj');
  await screen.findByText('Standard of Prajna.', undefined, { timeout: 4000 });
  return ctx;
};
const pick = (user: ReturnType<typeof userEvent.setup>, headword: string) =>
  user.click(
    within(screen.getByRole('list', { name: /matching authorities/i }))
      .getByText(headword)
      .closest('button') as HTMLElement,
  );

describe('[AC15] searching authorities from the panel', () => {
  it('[AC15] lists matches with headword and the start of the standard definition', async () => {
    await startLinking();
    const list = screen.getByRole('list', { name: /matching authorities/i });
    expect(list.textContent).toContain('Prajna');
    expect(list.textContent).toContain('Standard of Prajna.');
  });
});

describe('[AC16] relinking', () => {
  it('[AC16] asks first, naming both authorities and the preview change', async () => {
    const { user } = await startLinking();
    await pick(user, 'Prajna');
    const confirm = (await screen.findAllByRole('dialog')).pop() as HTMLElement;
    expect(confirm.textContent).toContain('Bodhicitta');
    expect(confirm.textContent).toContain('Prajna');
    expect(confirm.textContent).toMatch(/definition/i);
    expect(confirm.textContent).toMatch(/may change|might change|can change/i);
    expect(writes()).toEqual([]);
  });

  it('[AC16] cancelling changes nothing', async () => {
    const { user } = await startLinking();
    await pick(user, 'Prajna');
    const confirm = (await screen.findAllByRole('dialog')).pop() as HTMLElement;
    await user.click(within(confirm).getByRole('button', { name: /cancel/i }));
    await settle();
    expect(writes()).toEqual([]);
    expect(mockApi.stored?.authorityUuid).toBe('auth-1');
    expect(dialog().textContent).toContain('Bodhicitta');
  });

  it('[AC16] confirming moves the entry to the chosen authority', async () => {
    const { user } = await startLinking();
    await pick(user, 'Prajna');
    const confirm = (await screen.findAllByRole('dialog')).pop() as HTMLElement;
    await user.click(
      within(confirm).getByRole('button', {
        name: /^(link|confirm|relink|move)/i,
      }),
    );
    await settle();
    expect(writes()).toHaveLength(1);
    expect(Object.keys(lastWrite().change)).toEqual(['authorityUuid']);
    expect(lastWrite().change['authorityUuid']).toBe('auth-2');
    expect(mockApi.stored?.authorityUuid).toBe('auth-2');
    expect(dialog().textContent).toContain('Prajna');
  });
});

describe('[AC17] no create, no unlink', () => {
  it('[AC17] offers no control to create or unlink an authority', async () => {
    await start(makeEntry(BASE()));
    const names = within(dialog())
      .getAllByRole('button')
      .map((b) => `${b.textContent} ${b.getAttribute('aria-label') ?? ''}`);
    expect(
      names.filter((n) =>
        /create|new authority|unlink|detach|no authority/i.test(n),
      ),
    ).toEqual([]);
    const authoritySection = section(/authority/i);
    expect(maybeButton(authoritySection, /remove|clear|delete/i)).toBeNull();
  });

  it('[AC17] offers no create while searching, even with no match', async () => {
    mockApi.results = [];
    const { user } = await start(makeEntry(BASE()));
    await user.click(
      screen.getByRole('button', {
        name: /link another authority|link|change/i,
      }),
    );
    await user.type(screen.getByRole('searchbox'), 'zzz');
    await settle();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1500));
    });
    const labels = within(dialog())
      .getAllByRole('button')
      .map((b) => `${b.textContent} ${b.getAttribute('aria-label') ?? ''}`);
    expect(
      labels.filter((n) => /create|new authority|add authority/i.test(n)),
    ).toEqual([]);
  });
});

// ------------------------------------------------------------------ AC 18

describe('[AC18] each change saves on its own', () => {
  it('[AC18] writes each change as its own save, in order', async () => {
    const { user } = await start(makeEntry(BASE()));
    await user.click(
      radio(fieldset(/definition relation/i), /append the standard/i),
    );
    await settle();
    await user.click(radio(fieldset(/matching mode/i), /^marked/i));
    await settle();
    const select = within(itemOf('bodhicitta', section('Sanskrit'))).getByRole(
      'combobox',
    );
    await user.selectOptions(select, 'attestedOther');
    await settle();
    const alts = section('English alternatives');
    await user.click(button(alts, /add/i));
    await user.type(within(alts).getByRole('textbox'), 'brand new');
    await user.click(button(alts, /^add$/i));
    await settle();
    expect(writes().map((w) => Object.keys(w.change))).toEqual([
      ['definitionRend'],
      ['glossMode'],
      ['names'],
      ['names'],
    ]);
    expect(mockApi.stored).toMatchObject({
      definitionRend: 'appendWithStandard',
      glossMode: 'marked',
    });
    expect(find(storedNames(), 'bodhicitta')?.attestation).toBe(
      'attestedOther',
    );
    expect(find(storedNames(), 'brand new')).toBeDefined();
  });

  it('[AC18] a later save is guarded by the earlier one, so none is refused', async () => {
    const { user } = await start(makeEntry(BASE()));
    await user.click(radio(fieldset(/matching mode/i), /^marked/i));
    await settle();
    await user.click(
      radio(fieldset(/definition relation/i), /prepend the standard/i),
    );
    await settle();
    await user.click(radio(fieldset(/definition relation/i), /^none/i));
    await settle();
    expect(screen.queryByRole('button', { name: /use theirs/i })).toBeNull();
    expect(mockApi.stored).toMatchObject({
      glossMode: 'marked',
      definitionRend: null,
    });
  });

  it('[AC18] does not touch the entry definition', async () => {
    const { user } = await start(makeEntry(BASE()));
    await user.click(radio(fieldset(/matching mode/i), /^marked/i));
    await settle();
    for (const w of writes()) expect(w.change).not.toHaveProperty('definition');
    expect(mockApi.stored?.definition).toBe(ENTRY_DEFINITION);
  });
});

// ------------------------------------------------------------------ AC 19

describe('[AC19] round trip', () => {
  it('[AC19] saves nothing when it is opened and closed unchanged', async () => {
    const { user } = await start(makeEntry(BASE()));
    await settle();
    await user.click(screen.getByRole('button', { name: /close/i }));
    await settle();
    expect(writes()).toEqual([]);
  });

  it('[AC19] saves nothing for an odd stored entry opened and closed unchanged', async () => {
    const { user } = await start(
      makeEntry(
        [
          MAIN('awakening mind', { termType: null }),
          SA('bodhicitta', { termType: 'translationAlternative' }),
          name('other', { language: 'Ko-Ltn' }),
        ],
        { glossMode: null as unknown as string, definition: null },
      ),
    );
    await settle();
    await user.click(screen.getByRole('button', { name: /close/i }));
    await settle();
    expect(writes()).toEqual([]);
  });

  it('[AC19] saves nothing when an edit form is cancelled', async () => {
    const { user } = await start(makeEntry(BASE()));
    const main = section('Main English name');
    await user.click(button(main, /edit/i));
    await user.type(within(main).getByRole('textbox'), ' changed');
    await user.click(button(main, /cancel/i));
    await settle();
    expect(writes()).toEqual([]);
    expect(section('Main English name').textContent).toContain(
      'awakening mind',
    );
    expect(section('Main English name').textContent).not.toContain('changed');
  });

  it('[AC19] saves nothing when an edit is saved unchanged', async () => {
    const { user } = await start(makeEntry(BASE()));
    const main = section('Main English name');
    await user.click(button(main, /edit/i));
    await user.click(button(main, /save/i));
    await settle();
    expect(writes()).toEqual([]);
  });

  it('[AC19] saves nothing when the current choice is chosen again', async () => {
    const { user } = await start(makeEntry(BASE(), { glossMode: 'marked' }));
    await user.click(radio(fieldset(/matching mode/i), /^marked/i));
    await user.click(radio(fieldset(/definition relation/i), /^none/i));
    await settle();
    expect(writes()).toEqual([]);
  });

  it('[AC19] reads back every value it set when the panel is opened again', async () => {
    const first = await start(makeEntry(BASE()));
    const { user } = first;
    await user.click(
      radio(
        fieldset(/definition relation/i),
        /incompatible with the standard/i,
      ),
    );
    await settle();
    await user.click(radio(fieldset(/matching mode/i), /^marked/i));
    await settle();
    for (const [group, text, language] of [
      ['English alternatives', 'rt alt', 'en'],
      ['Sanskrit', 'rt sa', 'Sa-Ltn'],
      ['Pali', 'rt pi', 'Pi-Ltn'],
      ['Chinese', 'rt zh', 'zh'],
    ]) {
      const scope = section(group);
      await user.click(button(scope, /add/i));
      await user.type(within(scope).getByRole('textbox'), text);
      await user.click(button(scope, /^add$/i));
      await settle();
      expect(language).toBeTruthy();
    }
    await user.selectOptions(
      within(itemOf('rt sa', section('Sanskrit'))).getByRole('combobox'),
      'reconstructedSemantic',
    );
    await settle();
    const tib = section('Tibetan');
    await user.click(button(tib, /add/i));
    await user.type(within(tib).getByRole('textbox'), 'ཀཀ');
    await user.click(button(tib, /^add$/i));
    await settle();

    const stored = mockApi.stored as GlossaryEntry;
    first.view.unmount();

    // A new session reads the entry back as stored.
    mockApi.saves = [];
    const again = await start(stored);
    expect(writes().length).toBe(0);
    expect(
      radio(fieldset(/definition relation/i), /incompatible with the standard/i)
        .checked,
    ).toBe(true);
    expect(radio(fieldset(/matching mode/i), /^marked/i).checked).toBe(true);
    expect(section('English alternatives').textContent).toContain('rt alt');
    expect(section('Pali').textContent).toContain('rt pi');
    expect(section('Chinese').textContent).toContain('rt zh');
    expect(itemOf('w(ཀཀ)', section('Tibetan')).textContent).toContain('ཀཀ');
    expect(
      (
        within(itemOf('rt sa', section('Sanskrit'))).getByRole(
          'combobox',
        ) as HTMLSelectElement
      ).value,
    ).toBe('reconstructedSemantic');
    expect(again.user).toBeDefined();
  });
});

// ------------------------------------------------------------------ AC 20

describe('[AC20] conflicts', () => {
  const changedElsewhere = (patch: Partial<GlossaryEntry>) => {
    mockApi.stored = { ...(mockApi.stored as GlossaryEntry), ...patch };
  };

  it('[AC20] refuses the save, shows the conflict and keeps the editor value', async () => {
    const { user } = await start(makeEntry(BASE()));
    changedElsewhere({ definitionRend: 'appendWithStandard' });
    await user.click(
      radio(fieldset(/definition relation/i), /override with the standard/i),
    );
    await settle();
    expect(
      await screen.findByRole('button', { name: /use theirs/i }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /keep mine/i })).toBeTruthy();
    // Nothing was written over their change.
    expect(mockApi.stored?.definitionRend).toBe('appendWithStandard');
    // The editor's value stays in the field.
    expect(
      radio(fieldset(/definition relation/i), /override with the standard/i)
        .checked,
    ).toBe(true);
  });

  it('[AC20] "Use theirs" takes the stored value', async () => {
    const { user } = await start(makeEntry(BASE()));
    changedElsewhere({ definitionRend: 'appendWithStandard' });
    await user.click(
      radio(fieldset(/definition relation/i), /override with the standard/i),
    );
    await settle();
    await user.click(
      await screen.findByRole('button', { name: /use theirs/i }),
    );
    await settle();
    expect(screen.queryByRole('button', { name: /keep mine/i })).toBeNull();
    expect(
      radio(fieldset(/definition relation/i), /append the standard/i).checked,
    ).toBe(true);
    expect(mockApi.stored?.definitionRend).toBe('appendWithStandard');
  });

  it('[AC20] "Keep mine" settles the conflict and keeps the editor value', async () => {
    const { user } = await start(makeEntry(BASE()));
    changedElsewhere({ definitionRend: 'appendWithStandard' });
    await user.click(
      radio(fieldset(/definition relation/i), /override with the standard/i),
    );
    await settle();
    await user.click(await screen.findByRole('button', { name: /keep mine/i }));
    await settle();
    expect(screen.queryByRole('button', { name: /use theirs/i })).toBeNull();
    expect(
      radio(fieldset(/definition relation/i), /override with the standard/i)
        .checked,
    ).toBe(true);
  });

  it('[AC20] refuses a name added over a name list that changed elsewhere', async () => {
    const { user } = await start(makeEntry(BASE()));
    changedElsewhere({
      names: [
        ...(mockApi.stored as GlossaryEntry).names,
        ALT('added elsewhere'),
      ],
    });
    const alts = section('English alternatives');
    await user.click(button(alts, /add/i));
    await user.type(within(alts).getByRole('textbox'), 'added by me');
    await user.click(button(alts, /^add$/i));
    await settle();
    expect(
      await screen.findByRole('button', { name: /use theirs/i }),
    ).toBeTruthy();
    expect(find(storedNames(), 'added by me')).toBeUndefined();
    expect(find(storedNames(), 'added elsewhere')).toBeDefined();
    const kept =
      (dialog().textContent ?? '') +
      Array.from(dialog().querySelectorAll('input'))
        .map((i) => i.value)
        .join(' ');
    expect(kept).toContain('added by me');
  });

  it('[AC20] shows the conflict for an entry deleted elsewhere', async () => {
    const { user } = await start(makeEntry(BASE()));
    mockApi.stored = null;
    // The fake save reports a stale write when nothing is stored.
    const data = jest.requireMock('@eightyfourthousand/data-access');
    data.saveGlossaryEntry.mockImplementationOnce(async () => ({
      success: false,
      reason: 'not-found',
      error: 'gone',
      outcomeUnknown: false,
    }));
    await user.click(radio(fieldset(/matching mode/i), /^marked/i));
    await settle();
    expect(dialog().textContent).toMatch(
      /deleted|no longer|removed|gone|conflict|changed/i,
    );
    expect(radio(fieldset(/matching mode/i), /^marked/i).checked).toBe(true);
  });
});
