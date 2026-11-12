/**
 * Acceptance tests for DEV-883 definition criteria 5 (the save leg), 6 and 7:
 * `saveGlossaryWork` writes the edited rows and only those, each guarded by
 * the entry as it was read, and a refused save is a conflict that keeps the
 * editor's text.
 *
 * Written from the spec (TASK.md, CONTRACT.md), not the implementation. Only
 * data-access is faked, at the module boundary: the fake keeps entries the way
 * the database does, so a save is refused when the entry changed since it was
 * read.
 *
 * Not checked here (a browser check, done by the conductor on the local
 * stack): that reloading the glossary tab and the draft reader shows the new
 * text. The "reload" tests below read the fake back through a fresh work.
 */
import { GLOSSARY_SEED_DEFINITIONS } from './glossary-seed.fixture';
import { loadGlossaryWork, type GlossaryWork } from './glossary-work';
import {
  keepMyGlossaryEntry,
  saveGlossaryWork,
  takeTheirGlossaryEntry,
  unsavedGlossaryChanges,
} from './glossary-save';
import {
  glossaryFake,
  plainText,
  WORK,
  type GlossaryFake,
  type GlossaryItem,
  type PageArgs,
  type SaveArgs,
} from './glossary-work.fixture';

// See PassageStackController.spec.ts: building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

let fake: GlossaryFake;
const mockPage = (args: PageArgs) => fake.page(args);
const mockEntries = (args: { workUuid: string; uuids: readonly string[] }) =>
  fake.entries(args);
const mockSave = (args: SaveArgs) => fake.save(args);
const mockRead = (args: { uuid: string }) => fake.read(args);

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getWorkGlossaryTermsPage: (args: PageArgs) => mockPage(args),
  getGlossaryEntries: (args: { workUuid: string; uuids: readonly string[] }) =>
    mockEntries(args),
  saveGlossaryEntry: (args: SaveArgs) => mockSave(args),
  getGlossaryEntry: (args: { uuid: string }) => mockRead(args),
  createBrowserClient: () => ({}),
}));

const THREE: GlossaryItem[] = [
  { uuid: 'g1', termNumber: 1, definition: '<p>First.</p>' },
  { uuid: 'g2', termNumber: 2, definition: '<p>Second.</p>' },
  { uuid: 'g3', termNumber: 3, definition: '<p>Third.</p>' },
];

/** A glossary of `items`, every row hydrated. */
const loaded = async (items: GlossaryItem[] = THREE): Promise<GlossaryWork> => {
  fake = glossaryFake(items);
  const glossary = await loadGlossaryWork({
    workUuid: WORK,
    client: fake.client,
    graphql: {} as never,
  });
  if (!glossary) throw new Error('the glossary did not load');
  await glossary.work.hydrateWindow({ start: 0, end: items.length });
  return glossary;
};

const para = (text: string, marks?: { type: string }[]) => ({
  type: 'paragraph',
  content: [{ type: 'text', text, ...(marks ? { marks } : {}) }],
});

/** Edit a row's text the way a typist does: new content, row marked edited. */
const edit = (glossary: GlossaryWork, uuid: string, text: string) => {
  const doc = glossary.work.store.peek(uuid);
  if (!doc) throw new Error(`row ${uuid} has no document`);
  doc.replaceContent({ type: 'doc', content: [para(text)] });
  doc.markDirty();
};

const textOf = (glossary: GlossaryWork, uuid: string) =>
  glossary.work.store.peek(uuid)?.toNode().textContent;

/** The definition each save call sent, by entry. */
const sent = () =>
  fake.save.mock.calls.map(([args]) => ({
    uuid: args.before.uuid,
    before: args.before.definition,
    after: args.after.definition,
  }));

/** A fresh work over what the fake holds now, rows hydrated. */
const reloaded = async () => {
  const glossary = await loadGlossaryWork({
    workUuid: WORK,
    client: fake.client,
    graphql: {} as never,
  });
  if (!glossary) throw new Error('the glossary did not reload');
  await glossary.work.hydrateWindow({
    start: 0,
    end: glossary.work.spine.entries().length,
  });
  return glossary;
};

describe('criterion 6: a save writes the edited text, and only edited rows', () => {
  it('criterion 6: an unedited row sends no save', async () => {
    const glossary = await loaded();

    expect(unsavedGlossaryChanges(glossary)).toBe(0);
    const saved = await saveGlossaryWork(glossary, fake.client);

    expect(saved).toBe(true);
    expect(fake.save).not.toHaveBeenCalled();
  });

  it('criterion 6: an edited row sends one save, and the others none', async () => {
    const glossary = await loaded();
    const before = fake.stored.get('g2');

    edit(glossary, 'g2', 'Second, edited.');
    expect(unsavedGlossaryChanges(glossary)).toBe(1);
    const saved = await saveGlossaryWork(glossary, fake.client);

    expect(saved).toBe(true);
    expect(fake.save).toHaveBeenCalledTimes(1);
    const [args] = fake.save.mock.calls[0];
    expect(args.workUuid).toBe(WORK);
    expect(args.client).toBe(fake.client);
    // Guarded by the entry as it was read.
    expect(args.before).toEqual(before);
    expect(plainText(args.after.definition ?? null)).toBe('Second, edited.');
  });

  it('criterion 6: the saved definition is the edited text, with its marks', async () => {
    const glossary = await loaded();

    glossary.work.store.peek('g1')?.replaceContent({
      type: 'doc',
      content: [para('Edited and bold', [{ type: 'bold' }])],
    });
    glossary.work.store.peek('g1')?.markDirty();
    await saveGlossaryWork(glossary, fake.client);

    const definition = fake.save.mock.calls[0][0].after.definition ?? '';
    expect(definition).toMatch(/^<p[ >]/);
    expect(definition).toMatch(
      /<(strong|b)\b[^>]*>Edited and bold<\/(strong|b)>/,
    );
  });

  it('criterion 6: after a save the row is settled and a second save sends nothing', async () => {
    const glossary = await loaded();

    edit(glossary, 'g1', 'First, edited.');
    await saveGlossaryWork(glossary, fake.client);

    expect(unsavedGlossaryChanges(glossary)).toBe(0);
    expect(glossary.work.store.peek('g1')?.isDirty).toBe(false);
    expect(textOf(glossary, 'g1')).toBe('First, edited.');

    expect(await saveGlossaryWork(glossary, fake.client)).toBe(true);
    expect(fake.save).toHaveBeenCalledTimes(1);
  });

  it('criterion 6: edits to several rows are written one entry at a time', async () => {
    const glossary = await loaded();

    edit(glossary, 'g1', 'One.');
    edit(glossary, 'g3', 'Three.');
    expect(unsavedGlossaryChanges(glossary)).toBe(2);
    const saved = await saveGlossaryWork(glossary, fake.client);

    expect(saved).toBe(true);
    expect(
      sent()
        .map((call) => call.uuid)
        .sort(),
    ).toEqual(['g1', 'g3']);
    expect(fake.state.maxInFlight).toBe(1);
    expect(plainText(fake.stored.get('g1')?.definition ?? null)).toBe('One.');
    expect(plainText(fake.stored.get('g3')?.definition ?? null)).toBe('Three.');
    expect(fake.stored.get('g2')?.definition).toBe('<p>Second.</p>');
  });

  it('criterion 6: a later edit is guarded by the entry the earlier save wrote', async () => {
    const glossary = await loaded();

    edit(glossary, 'g1', 'Once.');
    await saveGlossaryWork(glossary, fake.client);
    const writtenFirst = fake.stored.get('g1')?.definition;
    edit(glossary, 'g1', 'Twice.');
    const saved = await saveGlossaryWork(glossary, fake.client);

    expect(saved).toBe(true);
    expect(sent()).toHaveLength(2);
    expect(sent()[1].before).toBe(writtenFirst);
    expect(plainText(fake.stored.get('g1')?.definition ?? null)).toBe('Twice.');
  });

  it('criterion 6: the new text is what a fresh load of the glossary shows', async () => {
    const glossary = await loaded();

    edit(glossary, 'g2', 'Seen again.');
    await saveGlossaryWork(glossary, fake.client);
    const again = await reloaded();

    expect(textOf(again, 'g2')).toBe('Seen again.');
    expect(textOf(again, 'g1')).toBe('First.');
  });
});

describe('criterion 5: an unedited definition is saved back unchanged, or not at all', () => {
  const SEEDS: GlossaryItem[] = GLOSSARY_SEED_DEFINITIONS.map(
    ([, html], i) => ({
      uuid: `s${i + 1}`,
      termNumber: i + 1,
      definition: html,
    }),
  );

  it('criterion 5: saving a work of seed definitions nobody edited writes nothing', async () => {
    const glossary = await loaded(SEEDS);

    expect(await saveGlossaryWork(glossary, fake.client)).toBe(true);

    expect(fake.save).not.toHaveBeenCalled();
    SEEDS.forEach((item) =>
      expect(fake.stored.get(item.uuid)?.definition).toBe(item.definition),
    );
  });

  it('criterion 5: editing one seed row leaves every other seed definition as stored', async () => {
    const glossary = await loaded(SEEDS);

    edit(glossary, 's1', 'Only this one changed.');
    await saveGlossaryWork(glossary, fake.client);

    expect(sent().map((call) => call.uuid)).toEqual(['s1']);
    SEEDS.slice(1).forEach((item) =>
      expect(fake.stored.get(item.uuid)?.definition).toBe(item.definition),
    );
  });

  it('criterion 5: a row marked edited without changing a character is not rewritten differently', async () => {
    const glossary = await loaded(SEEDS);

    SEEDS.forEach((item) => glossary.work.store.peek(item.uuid)?.markDirty());
    await saveGlossaryWork(glossary, fake.client);

    // Either no save at all, or a save that writes the definition it read.
    sent().forEach((call) => {
      expect(call.after === undefined || call.after === call.before).toBe(true);
    });
    SEEDS.forEach((item) =>
      expect(fake.stored.get(item.uuid)?.definition).toBe(item.definition),
    );
  });
});

describe('criterion 7: a conflicting save keeps the editor’s text', () => {
  /** Another editor changes g1 after this one read it; this one edits too. */
  const conflicted = async () => {
    const glossary = await loaded();
    const entry = fake.stored.get('g1');
    if (!entry) throw new Error('no entry');
    const theirs = { ...entry, definition: '<p>Theirs.</p>' };
    fake.stored.set('g1', theirs);
    edit(glossary, 'g1', 'Mine.');
    return { glossary, theirs };
  };

  it.each(['stale'])(
    'criterion 7: a save refused as %s is not a success, and writes nothing',
    async (reason) => {
      const { glossary, theirs } = await conflicted();
      fake.state.refusal = reason;

      const saved = await saveGlossaryWork(glossary, fake.client);

      expect(saved).toBe(false);
      expect(fake.stored.get('g1')).toEqual(theirs);
    },
  );

  it.each(['stale'])(
    'criterion 7: a save refused as %s records the conflict, with the stored entry',
    async (reason) => {
      const { glossary, theirs } = await conflicted();
      fake.state.refusal = reason;

      await saveGlossaryWork(glossary, fake.client);

      expect(glossary.conflicts.get('g1')).toMatchObject({ theirs });
    },
  );

  it.each(['stale'])(
    'criterion 7: a save refused as %s keeps the local text, still unsaved',
    async (reason) => {
      const { glossary } = await conflicted();
      fake.state.refusal = reason;

      await saveGlossaryWork(glossary, fake.client);

      expect(textOf(glossary, 'g1')).toBe('Mine.');
      expect(glossary.work.store.peek('g1')?.isDirty).toBe(true);
      expect(unsavedGlossaryChanges(glossary)).toBeGreaterThanOrEqual(1);
    },
  );

  it('criterion 7: an entry deleted elsewhere is a conflict with nothing stored', async () => {
    const glossary = await loaded();
    fake.stored.delete('g2');
    edit(glossary, 'g2', 'Mine.');

    const saved = await saveGlossaryWork(glossary, fake.client);

    expect(saved).toBe(false);
    expect(glossary.conflicts.get('g2')).toMatchObject({ theirs: null });
    expect(textOf(glossary, 'g2')).toBe('Mine.');
  });

  it('criterion 7: a conflict on one row does not stop the other rows saving', async () => {
    const { glossary } = await conflicted();
    edit(glossary, 'g3', 'Third, edited.');

    const saved = await saveGlossaryWork(glossary, fake.client);

    expect(saved).toBe(false);
    expect(plainText(fake.stored.get('g3')?.definition ?? null)).toBe(
      'Third, edited.',
    );
    expect(glossary.conflicts.get('g3') ?? null).toBeNull();
    expect(glossary.conflicts.get('g2') ?? null).toBeNull();
    expect(glossary.conflicts.get('g1')).not.toBeNull();
  });

  it('criterion 7: a save that fails for another reason keeps the text and stays unsaved', async () => {
    const glossary = await loaded();
    edit(glossary, 'g1', 'Mine.');
    fake.save.mockResolvedValueOnce({
      success: false,
      reason: 'failed',
      error: 'connection lost',
      outcomeUnknown: false,
    });

    const saved = await saveGlossaryWork(glossary, fake.client);

    expect(saved).toBe(false);
    expect(textOf(glossary, 'g1')).toBe('Mine.');
    expect(glossary.work.store.peek('g1')?.isDirty).toBe(true);
    expect(unsavedGlossaryChanges(glossary)).toBeGreaterThanOrEqual(1);
  });

  it('criterion 7: using theirs takes the stored text and clears the conflict', async () => {
    const { glossary, theirs } = await conflicted();
    await saveGlossaryWork(glossary, fake.client);

    await takeTheirGlossaryEntry(glossary, 'g1');

    expect(glossary.conflicts.get('g1') ?? null).toBeNull();
    expect(textOf(glossary, 'g1')).toBe('Theirs.');
    expect(glossary.work.store.peek('g1')?.isDirty).toBe(false);
    expect(unsavedGlossaryChanges(glossary)).toBe(0);
    // Nothing more to write; a later edit is guarded by their entry.
    fake.save.mockClear();
    expect(await saveGlossaryWork(glossary, fake.client)).toBe(true);
    expect(fake.save).not.toHaveBeenCalled();
    edit(glossary, 'g1', 'After theirs.');
    expect(await saveGlossaryWork(glossary, fake.client)).toBe(true);
    expect(sent()[0].before).toBe(theirs.definition);
  });

  it('criterion 7: keeping mine clears the conflict, keeps the text, and saves over theirs', async () => {
    const { glossary, theirs } = await conflicted();
    await saveGlossaryWork(glossary, fake.client);
    fake.save.mockClear();

    await keepMyGlossaryEntry(glossary, 'g1');

    expect(glossary.conflicts.get('g1') ?? null).toBeNull();
    expect(textOf(glossary, 'g1')).toBe('Mine.');
    expect(glossary.work.store.peek('g1')?.isDirty).toBe(true);

    const saved = await saveGlossaryWork(glossary, fake.client);

    expect(saved).toBe(true);
    // Now guarded by what the other editor wrote.
    expect(sent()).toEqual([
      expect.objectContaining({ uuid: 'g1', before: theirs.definition }),
    ]);
    expect(plainText(fake.stored.get('g1')?.definition ?? null)).toBe('Mine.');
  });
});
