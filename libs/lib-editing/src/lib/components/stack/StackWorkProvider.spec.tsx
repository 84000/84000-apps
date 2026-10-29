import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

import {
  BODY_MATTER_FILTER,
  FRONT_MATTER_FILTER,
} from '@eightyfourthousand/data-access';

import type { SaveHandler } from '../editor/EditorProvider';
import { createStackWorkDocument } from './stack-work';
import { buildBibliographySchemaExtensions } from './bibliography-extensions';
import type { BibliographyWork } from './bibliography-work';
import {
  StackWorkProvider,
  useStackWork,
  type StackWork,
} from './StackWorkProvider';
import { PassageStackController } from './PassageStackController';
import { StackReaderProvider } from './StackReaderProvider';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({})),
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  getTranslationBlocksAround: jest.fn(),
}));

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: jest.fn(() => ({})),
}));

jest.mock('./bibliography-work', () => ({
  loadBibliographyWork: jest.fn(),
  unsavedBibliographyChanges: jest.fn(() => 0),
  saveBibliographyWork: jest.fn(),
}));

jest.mock('./stack-save', () => {
  const actual = jest.requireActual('./stack-save');
  return {
    ...actual,
    hasUnsavedStackChanges: jest.fn(actual.hasUnsavedStackChanges),
    saveStackWork: jest.fn(actual.saveStackWork),
  };
});

const stackSave = jest.requireMock('./stack-save') as {
  hasUnsavedStackChanges: jest.Mock;
  saveStackWork: jest.Mock;
};

const bibliographyWork = jest.requireMock('./bibliography-work') as {
  loadBibliographyWork: jest.Mock;
  unsavedBibliographyChanges: jest.Mock;
  saveBibliographyWork: jest.Mock;
};

const mockEditorState = {
  registerSaveHandler: jest.fn(),
  dirtyStore: { setDirty: jest.fn() },
};

jest.mock('../editor/EditorProvider', () => ({
  useEditorState: () => mockEditorState,
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  getPassageMetaPage: jest.Mock;
};

/** One page of a section's identities. */
const page = (prefix: string, type: string, count: number) => ({
  metas: Array.from({ length: count }, (_, i) => ({
    uuid: `${prefix}${i}`,
    label: `${i + 1}`,
    sort: i,
    type,
    toh: undefined,
  })),
  hasMoreAfter: false,
  hasMoreBefore: false,
});

const Probe = () => {
  const stack = useStackWork();
  if (!stack) return <div>seeding</div>;
  return (
    <div>
      <span data-testid="spine">{stack.work.spine.uuids().join(',')}</span>
      <span data-testid="main">
        {stack.controllerFor('translation')?.getOrder().join(',')}
      </span>
      <span data-testid="notes">
        {stack.controllerFor('endnotes')?.getOrder().join(',')}
      </span>
      <span data-testid="front">
        {String(stack.controllerFor('front')?.getOrder().join(','))}
      </span>
      <span data-testid="abbreviations">
        {String(stack.controllerFor('abbreviations')?.getOrder().join(','))}
      </span>
      <span data-testid="unstacked">
        {String(stack.controllerFor('glossary'))}
      </span>
    </div>
  );
};

/** A bibliography of one heading and the entry under it. */
const bibliography = (): BibliographyWork => {
  const work = createStackWorkDocument({
    workUuid: 'w1',
    extensions: buildBibliographySchemaExtensions(),
  });
  work.spine.seed([
    { uuid: 'h1', label: 'b.1', type: 'bibliographyHeader', sort: 1 },
    {
      uuid: 'e1',
      label: 'b.1.1',
      type: 'bibliography',
      sort: 2,
      parent: 'h1',
      depth: 1,
    },
  ]);
  return { work, rows: new Map() };
};

/** Every section seeded with one passage. */
const seedSections = () =>
  clientGraphql.getPassageMetaPage
    .mockResolvedValueOnce(page('f', 'introduction', 1))
    .mockResolvedValueOnce(page('p', 'translation', 1))
    .mockResolvedValueOnce(page('a', 'abbreviations', 0))
    .mockResolvedValueOnce(page('n', 'endnotes', 1));

describe('StackWorkProvider', () => {
  beforeEach(() => {
    clientGraphql.getPassageMetaPage.mockReset();
    bibliographyWork.loadBibliographyWork.mockReset().mockResolvedValue(null);
    bibliographyWork.unsavedBibliographyChanges.mockReset().mockReturnValue(0);
    bibliographyWork.saveBibliographyWork.mockReset();
    mockEditorState.registerSaveHandler.mockReset();
  });

  it('holds back until the sections are seeded', () => {
    clientGraphql.getPassageMetaPage.mockReturnValue(
      new Promise(() => undefined),
    );

    render(
      <StackWorkProvider workUuid="w1">
        <Probe />
      </StackWorkProvider>,
    );

    expect(screen.getByText('seeding')).toBeTruthy();
  });

  // Order is load bearing: a run with nothing in it yet is appended at the end
  // of the spine, so seeding out of order would put the back matter before the
  // body, or the body before the front matter.
  it('seeds the sections in the order the work reads', async () => {
    clientGraphql.getPassageMetaPage
      .mockResolvedValueOnce(page('f', 'introduction', 2))
      .mockResolvedValueOnce(page('p', 'translation', 2))
      .mockResolvedValueOnce(page('a', 'abbreviations', 2))
      .mockResolvedValueOnce(page('n', 'endnotes', 2));

    render(
      <StackWorkProvider workUuid="w1">
        <Probe />
      </StackWorkProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('spine').textContent).toBe(
        'f0,f1,p0,p1,a0,a1,n0,n1',
      ),
    );
  });

  it('gives each tab a view of its own passages', async () => {
    clientGraphql.getPassageMetaPage
      .mockResolvedValueOnce(page('f', 'introduction', 2))
      .mockResolvedValueOnce(page('p', 'translation', 2))
      .mockResolvedValueOnce(page('a', 'abbreviations', 2))
      .mockResolvedValueOnce(page('n', 'endnotes', 2));

    render(
      <StackWorkProvider workUuid="w1">
        <Probe />
      </StackWorkProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('main').textContent).toBe('p0,p1'),
    );
    expect(screen.getByTestId('notes').textContent).toBe('n0,n1');
    expect(screen.getByTestId('front').textContent).toBe('f0,f1');
    expect(screen.getByTestId('abbreviations').textContent).toBe('a0,a1');
  });

  // Many works have no front matter; the stack has nothing to draw, not
  // nothing to show.
  it('gives a work without front matter an empty front view', async () => {
    clientGraphql.getPassageMetaPage
      .mockResolvedValueOnce(page('f', 'introduction', 0))
      .mockResolvedValueOnce(page('p', 'translation', 1))
      .mockResolvedValueOnce(page('a', 'abbreviations', 0))
      .mockResolvedValueOnce(page('n', 'endnotes', 1));

    render(
      <StackWorkProvider workUuid="w1">
        <Probe />
      </StackWorkProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('spine').textContent).toBe('p0,n0'),
    );
    expect(screen.getByTestId('front').textContent).toBe('');
    expect(screen.getByTestId('abbreviations').textContent).toBe('');
  });

  it('reports nothing for a tab it does not draw', async () => {
    clientGraphql.getPassageMetaPage
      .mockResolvedValueOnce(page('f', 'introduction', 1))
      .mockResolvedValueOnce(page('p', 'translation', 1))
      .mockResolvedValueOnce(page('a', 'abbreviations', 0))
      .mockResolvedValueOnce(page('n', 'endnotes', 1));

    render(
      <StackWorkProvider workUuid="w1">
        <Probe />
      </StackWorkProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('unstacked').textContent).toBe('null'),
    );
  });

  it('asks for each section separately', async () => {
    clientGraphql.getPassageMetaPage
      .mockResolvedValueOnce(page('f', 'introduction', 1))
      .mockResolvedValueOnce(page('p', 'translation', 1))
      .mockResolvedValueOnce(page('a', 'abbreviations', 0))
      .mockResolvedValueOnce(page('n', 'endnotes', 1));

    render(
      <StackWorkProvider workUuid="w1">
        <Probe />
      </StackWorkProvider>,
    );

    await waitFor(() =>
      expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledTimes(4),
    );
    const types = clientGraphql.getPassageMetaPage.mock.calls.map(
      (call) => call[0].type,
    );
    expect(types).toEqual([
      FRONT_MATTER_FILTER,
      BODY_MATTER_FILTER,
      'abbreviations',
      'endnotes',
    ]);
  });

  describe('undo outside the editors', () => {
    /** The provider's work, once its sections are seeded. */
    const seeded = async () => {
      clientGraphql.getPassageMetaPage
        .mockResolvedValueOnce(page('f', 'introduction', 1))
        .mockResolvedValueOnce(page('p', 'translation', 1))
        .mockResolvedValueOnce(page('n', 'endnotes', 1));
      const found: { work?: StackWork['work'] } = {};
      const Grab = () => {
        const stack = useStackWork();
        useEffect(() => {
          if (stack) found.work = stack.work;
        }, [stack]);
        return null;
      };
      render(
        <StackWorkProvider workUuid="w1">
          <Grab />
        </StackWorkProvider>,
      );
      await waitFor(() => expect(found.work).toBeDefined());
      const work = found.work as StackWork['work'];
      return { work, undo: jest.spyOn(work, 'undo') };
    };

    const pressUndo = (handled = false) => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      if (handled) event.preventDefault();
      document.body.dispatchEvent(event);
    };

    it('undoes from the page', async () => {
      const { undo } = await seeded();
      pressUndo();
      expect(undo).toHaveBeenCalledTimes(1);
    });

    // An editor that handled the keystroke may be gone by the time the event
    // reaches the page, as when its undo moved focus to another passage.
    it('leaves a keystroke an editor already handled', async () => {
      const { undo } = await seeded();
      pressUndo(true);
      expect(undo).not.toHaveBeenCalled();
    });
  });

  describe('the bibliography', () => {
    /** The stack once seeded, and the save it registered. */
    const seeded = async () => {
      seedSections();
      const found: { stack?: StackWork } = {};
      const Grab = () => {
        const stack = useStackWork();
        useEffect(() => {
          if (stack) found.stack = stack;
        }, [stack]);
        return null;
      };
      render(
        <StackWorkProvider workUuid="w1">
          <Grab />
        </StackWorkProvider>,
      );
      await waitFor(() => expect(found.stack).toBeDefined());
      const calls = mockEditorState.registerSaveHandler.mock.calls;
      const handler = calls[calls.length - 1][0] as SaveHandler;
      return { stack: found.stack as StackWork, handler };
    };

    it('draws its rows in a view of their own work', async () => {
      const read = bibliography();
      bibliographyWork.loadBibliographyWork.mockResolvedValue(read);

      const { stack } = await seeded();

      const view = stack.controllerFor('bibliography');
      expect(view?.getOrder()).toEqual(['h1', 'e1']);
      expect(view?.work).toBe(read.work);
      expect(view?.getRows()).toBe('bibliography');
      expect(stack.work.spine.uuids()).not.toContain('e1');
    });

    it('has no view when its rows could not be read', async () => {
      const { stack } = await seeded();

      expect(stack.bibliography).toBeNull();
      expect(stack.controllerFor('bibliography')).toBeNull();
    });

    it('saves with the passages, from the one save', async () => {
      bibliographyWork.loadBibliographyWork.mockResolvedValue(bibliography());
      const { handler } = await seeded();
      expect(handler.isDirty()).toBe(false);
      expect(await handler.save()).toEqual({ outcome: 'none' });

      bibliographyWork.unsavedBibliographyChanges.mockReturnValue(2);
      bibliographyWork.saveBibliographyWork.mockResolvedValue(true);
      expect(handler.isDirty()).toBe(true);
      expect(handler.unsavedChanges()).toBe(2);
      expect(await handler.save()).toEqual({ outcome: 'saved' });

      bibliographyWork.saveBibliographyWork.mockResolvedValue(false);
      expect(await handler.save()).toEqual({ outcome: 'failed' });
      expect(bibliographyWork.saveBibliographyWork).toHaveBeenCalledTimes(2);
    });

    // An unknown save can end in a reload, which would discard them.
    it('counts unsaved rows against a passage save of unknown outcome', async () => {
      bibliographyWork.loadBibliographyWork.mockResolvedValue(bibliography());
      const { handler } = await seeded();
      const unconfirmed = {
        sent: ['p1'],
        inserted: [],
        deleted: [],
        newerChanges: () => 1,
        restore: async () => undefined,
      };
      stackSave.hasUnsavedStackChanges.mockReturnValueOnce(true);
      stackSave.saveStackWork.mockResolvedValueOnce({
        outcome: 'unknown',
        unconfirmed,
      });
      bibliographyWork.unsavedBibliographyChanges.mockReturnValue(1);
      bibliographyWork.saveBibliographyWork.mockResolvedValue(false);

      const report = await handler.save();

      expect(report.outcome).toBe('unknown');
      expect(report.unconfirmed?.sent).toEqual(['p1']);
      expect(report.unconfirmed?.newerChanges()).toBe(2);
    });

    it('undoes from the page in the work last worked in', async () => {
      const read = bibliography();
      bibliographyWork.loadBibliographyWork.mockResolvedValue(read);
      const { stack } = await seeded();
      const rowUndo = jest.spyOn(read.work, 'undo');
      const passageUndo = jest.spyOn(stack.work, 'undo');
      const row = document.createElement('div');
      row.setAttribute('data-stack-passage', 'e1');
      document.body.append(row);
      const pressUndo = () =>
        document.body.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'z',
            metaKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );

      pressUndo();
      expect(passageUndo).toHaveBeenCalledTimes(1);

      row.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      pressUndo();
      expect(rowUndo).toHaveBeenCalledTimes(1);
      expect(passageUndo).toHaveBeenCalledTimes(1);
      row.remove();
    });
  });

  describe('read-only', () => {
    const seeded = async (readOnly: boolean) => {
      seedSections();
      bibliographyWork.loadBibliographyWork.mockResolvedValue(bibliography());
      const found: { stack?: StackWork } = {};
      const Grab = () => {
        const stack = useStackWork();
        useEffect(() => {
          if (stack) found.stack = stack;
        }, [stack]);
        return null;
      };
      const view = render(
        <StackWorkProvider workUuid="w1" readOnly={readOnly}>
          <Grab />
        </StackWorkProvider>,
      );
      await waitFor(() => expect(found.stack).toBeDefined());
      const views = () =>
        ['front', 'translation', 'endnotes', 'bibliography'].map((tab) =>
          found.stack?.controllerFor(tab)?.isReadOnly(),
        );
      const rerender = (next: boolean) =>
        view.rerender(
          <StackWorkProvider workUuid="w1" readOnly={next}>
            <Grab />
          </StackWorkProvider>,
        );
      return { found, views, rerender };
    };

    it('builds every view read-only', async () => {
      const { found, views } = await seeded(true);

      expect(views()).toEqual([true, true, true, true]);
      expect(found.stack?.readOnly).toBe(true);
    });

    it('switches every view while drawn, keeping the same work', async () => {
      const { found, views, rerender } = await seeded(false);
      const work = found.stack?.work;
      expect(views()).toEqual([false, false, false, false]);

      rerender(true);
      await waitFor(() => expect(views()).toEqual([true, true, true, true]));
      expect(found.stack?.readOnly).toBe(true);
      expect(found.stack?.work).toBe(work);

      rerender(false);
      await waitFor(() =>
        expect(views()).toEqual([false, false, false, false]),
      );
    });

    it('does not undo from the page', async () => {
      const { found } = await seeded(true);
      const undo = jest.spyOn(found.stack?.work as StackWork['work'], 'undo');

      document.body.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          metaKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(undo).not.toHaveBeenCalled();
    });
  });
});

describe('StackReaderProvider', () => {
  beforeEach(() => {
    clientGraphql.getPassageMetaPage.mockReset();
    bibliographyWork.loadBibliographyWork.mockReset().mockResolvedValue(null);
    mockEditorState.registerSaveHandler.mockReset();
  });

  it("gives every tab a reader's view, with nothing to save", async () => {
    seedSections();
    const ReaderProbe = () => {
      const view = useStackWork()?.controllerFor('translation');
      if (!view) return null;
      return (
        <span data-testid="reader">
          {[
            view.isReadOnly() && 'read-only',
            !view.getEditing() && 'no editing',
            !(view instanceof PassageStackController) && 'reader view',
          ]
            .filter(Boolean)
            .join(', ')}
        </span>
      );
    };

    render(
      <StackReaderProvider workUuid="w1">
        <ReaderProbe />
      </StackReaderProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('reader').textContent).toBe(
        'read-only, no editing, reader view',
      ),
    );
    expect(mockEditorState.registerSaveHandler).not.toHaveBeenCalled();
  });
});
