/**
 * Acceptance tests for DEV-883 definition criterion 7, the editor half: a
 * refused save shows as a notice on the row, offering "Use theirs" and "Keep
 * mine", and the row keeps the local text.
 *
 * Written from the spec (TASK.md, CONTRACT.md), not the implementation. Only
 * data-access is faked, at the module boundary.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';

import { GlossaryRowConflict } from './glossary-row';
import { saveGlossaryWork } from './glossary-save';
import { loadGlossaryWork, type GlossaryWork } from './glossary-work';
import {
  glossaryFake,
  WORK,
  type GlossaryFake,
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

const loaded = async (): Promise<GlossaryWork> => {
  fake = glossaryFake([
    { uuid: 'g1', termNumber: 1, definition: '<p>Original.</p>' },
  ]);
  const glossary = await loadGlossaryWork({
    workUuid: WORK,
    client: fake.client,
    graphql: {} as never,
  });
  if (!glossary) throw new Error('the glossary did not load');
  await glossary.work.hydrateWindow({ start: 0, end: 1 });
  return glossary;
};

const editMine = (glossary: GlossaryWork) => {
  const doc = glossary.work.store.peek('g1');
  doc?.replaceContent({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Mine.' }] },
    ],
  });
  doc?.markDirty();
};

const save = (glossary: GlossaryWork) =>
  act(async () => {
    await saveGlossaryWork(glossary, fake.client);
  });

const textOf = (glossary: GlossaryWork) =>
  glossary.work.store.peek('g1')?.toNode().textContent;

describe('criterion 7: the row shows the conflict and keeps the local text', () => {
  it('criterion 7: shows nothing while the row has no conflict', async () => {
    const glossary = await loaded();

    render(<GlossaryRowConflict glossary={glossary} uuid="g1" />);

    expect(screen.queryByText(/use theirs/i)).toBeNull();
    expect(screen.queryByText(/keep mine/i)).toBeNull();
  });

  it('criterion 7: a refused save draws the notice, with the stored text and both choices', async () => {
    const glossary = await loaded();
    render(<GlossaryRowConflict glossary={glossary} uuid="g1" />);
    const entry = fake.stored.get('g1');
    if (!entry) throw new Error('no entry');
    fake.stored.set('g1', {
      ...entry,
      definition: '<p>Theirs, elsewhere.</p>',
    });
    editMine(glossary);

    await save(glossary);

    expect(screen.getByRole('button', { name: /use theirs/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /keep mine/i })).toBeTruthy();
    expect(document.body.textContent).toContain('Theirs, elsewhere.');
    expect(textOf(glossary)).toBe('Mine.');
  });

  it('criterion 7: "Use theirs" takes the stored text and the notice goes', async () => {
    const glossary = await loaded();
    render(<GlossaryRowConflict glossary={glossary} uuid="g1" />);
    const entry = fake.stored.get('g1');
    if (!entry) throw new Error('no entry');
    fake.stored.set('g1', {
      ...entry,
      definition: '<p>Theirs, elsewhere.</p>',
    });
    editMine(glossary);
    await save(glossary);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /use theirs/i }));
    });

    expect(textOf(glossary)).toBe('Theirs, elsewhere.');
    expect(screen.queryByRole('button', { name: /use theirs/i })).toBeNull();
    expect(glossary.conflicts.get('g1') ?? null).toBeNull();
  });

  it('criterion 7: "Keep mine" keeps the local text and the notice goes', async () => {
    const glossary = await loaded();
    render(<GlossaryRowConflict glossary={glossary} uuid="g1" />);
    const entry = fake.stored.get('g1');
    if (!entry) throw new Error('no entry');
    fake.stored.set('g1', {
      ...entry,
      definition: '<p>Theirs, elsewhere.</p>',
    });
    editMine(glossary);
    await save(glossary);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /keep mine/i }));
    });

    expect(textOf(glossary)).toBe('Mine.');
    expect(screen.queryByRole('button', { name: /keep mine/i })).toBeNull();
    expect(glossary.conflicts.get('g1') ?? null).toBeNull();
  });

  it('criterion 7: an entry deleted elsewhere says so, and offers to remove the row', async () => {
    const glossary = await loaded();
    const onRemove = jest.fn();
    render(
      <GlossaryRowConflict glossary={glossary} uuid="g1" onRemove={onRemove} />,
    );
    fake.stored.delete('g1');
    editMine(glossary);

    await save(glossary);

    expect(document.body.textContent).toMatch(/deleted/i);
    expect(screen.queryByRole('button', { name: /use theirs/i })).toBeNull();
    expect(textOf(glossary)).toBe('Mine.');

    fireEvent.click(screen.getByRole('button', { name: /remove it/i }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('criterion 7: without a way to remove the row, a deleted entry offers no removal', async () => {
    const glossary = await loaded();
    render(<GlossaryRowConflict glossary={glossary} uuid="g1" />);
    fake.stored.delete('g1');
    editMine(glossary);

    await save(glossary);

    expect(document.body.textContent).toMatch(/deleted/i);
    expect(screen.queryByRole('button', { name: /remove it/i })).toBeNull();
  });
});
