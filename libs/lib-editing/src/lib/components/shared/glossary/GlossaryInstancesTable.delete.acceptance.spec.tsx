import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  EditorContext,
  type EditorContextState,
} from '../../editor/editor-context';
import { GlossaryInstancesTable } from './GlossaryInstancesTable';

// Acceptance tests for DEV-912, criteria 6 (delete one), 7 (delete selected),
// 8 (partial failure), 9 (open sessions) and 10 (permission). The server is
// mocked: reads answer from a list, and a delete removes what it reports
// removed. The editor's state arrives through EditorContext.

const PAGE = 50;

type Instance = {
  uuid: string;
  passageUuid: string;
  passageLabel: string;
  passageType: string;
  passageSort: number;
  start: number;
  end: number;
  before: string;
  text: string;
  after: string;
  truncatedStart: boolean;
  truncatedEnd: boolean;
  outOfRange: boolean;
};

const instance = (i: number): Instance => ({
  uuid: `a-${i}`,
  passageUuid: `p-${i}`,
  passageLabel: `1.${i + 1}`,
  passageType: 'translation',
  passageSort: i + 1,
  start: 400 + i,
  end: 411 + i,
  before: 'the earlier words',
  text: 'bodhisattva',
  after: 'and the later words',
  truncatedStart: false,
  truncatedEnd: false,
  outOfRange: false,
});

let rows: Instance[] = [];

const mockNavigation = { toh: 'toh8', updatePanel: jest.fn() };
const mockGetInstances = jest.fn();
const mockRemoveInstances = jest.fn();

jest.mock('../NavigationContext', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  getGlossaryTermInstances: (...args: unknown[]) => mockGetInstances(...args),
  removeGlossaryTermInstances: (...args: unknown[]) =>
    mockRemoveInstances(...args),
}));

const serve = (count: number) => {
  rows = Array.from({ length: count }, (_, i) => instance(i));
  mockGetInstances.mockImplementation(
    async ({
      offset = 0,
      first = PAGE,
    }: {
      offset?: number;
      first?: number;
    }) => ({
      items: rows.slice(offset, offset + first),
      totalCount: rows.length,
      offset,
    }),
  );
};

type RemoveArgs = { annotationUuids: string[] };
type Failure = {
  passageUuid: string;
  passageLabel: string;
  annotationUuids: string[];
  error: string;
};

/** A delete that succeeds, except for the passages named. */
const deleting = (failures: Failure[] = []) => {
  mockRemoveInstances.mockImplementation(
    async ({ annotationUuids }: RemoveArgs) => {
      const failedUuids = failures.flatMap((f) => f.annotationUuids);
      const removed = annotationUuids.filter((u) => !failedUuids.includes(u));
      rows = rows.filter((row) => !removed.includes(row.uuid));
      return {
        removed,
        failed: failures,
        passages: removed.map((uuid) => ({
          uuid: `p-${uuid.slice(2)}`,
          json: null,
        })),
      };
    },
  );
};

const applyReplacedPassages = jest.fn(async () => undefined);
const save = jest.fn(async () => undefined);

const editorState = (readOnly: boolean) =>
  ({
    work: { uuid: 'work-1' },
    readOnly,
    editPermitted: !readOnly,
    dirtyStore: {
      isDirty: false,
      listeners: new Set(),
      subscribe: () => () => undefined,
      setDirty: () => undefined,
      getSnapshot: () => false,
    },
    canEdit: async () => !readOnly,
    save,
    applyReplacedPassages,
  }) as unknown as EditorContextState;

const renderTable = (readOnly = false) =>
  render(
    <EditorContext.Provider value={editorState(readOnly)}>
      <GlossaryInstancesTable termUuid="term-1" onClose={jest.fn()} />
    </EditorContext.Provider>,
  );

const labelButtons = () =>
  within(screen.getByRole('table', { name: 'Instances' })).queryAllByRole(
    'button',
    { name: /^1\.\d+$/ },
  );
const labels = () => labelButtons().map((b) => b.textContent);

const ready = async () => {
  await screen.findByRole('table', { name: 'Instances' });
  await waitFor(() => expect(labelButtons().length).toBeGreaterThan(0));
};

const confirm = async () => {
  const dialog = await screen.findByRole('alertdialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
};

/** How many times a passage label is written anywhere in what is drawn. */
const mentions = (container: HTMLElement, label: string) =>
  (
    container.textContent?.match(
      new RegExp(`${label.replace('.', '\\.')}(?!\\d)`, 'g'),
    ) ?? []
  ).length;

beforeEach(() => {
  mockGetInstances.mockReset();
  mockRemoveInstances.mockReset();
  applyReplacedPassages.mockClear();
  save.mockClear();
  window.history.replaceState(null, '', '/');
});

describe('DEV-912 criterion 6: delete one', () => {
  it('criterion 6: each row has a delete action', async () => {
    serve(3);
    renderTable();
    await ready();

    for (const label of ['1.1', '1.2', '1.3']) {
      expect(
        screen.getByRole('button', { name: `Delete instance in ${label}` }),
      ).toBeTruthy();
    }
  });

  it('criterion 6: the delete action asks for confirmation and deletes nothing yet', async () => {
    serve(3);
    renderTable();
    await ready();

    await userEvent.click(
      screen.getByRole('button', { name: 'Delete instance in 1.2' }),
    );

    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(mockRemoveInstances).not.toHaveBeenCalled();
  });

  it('criterion 6: cancelling the confirmation deletes nothing and keeps the row', async () => {
    serve(3);
    renderTable();
    await ready();
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete instance in 1.2' }),
    );
    const dialog = await screen.findByRole('alertdialog');

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(mockRemoveInstances).not.toHaveBeenCalled();
    expect(labels()).toEqual(['1.1', '1.2', '1.3']);
  });

  it('criterion 6: confirming deletes that instance of this entry in this work, by its annotation', async () => {
    serve(3);
    deleting();
    renderTable();
    await ready();
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete instance in 1.2' }),
    );

    await confirm();

    await waitFor(() => expect(mockRemoveInstances).toHaveBeenCalledTimes(1));
    expect(mockRemoveInstances.mock.calls[0][0]).toMatchObject({
      workUuid: 'work-1',
      termUuid: 'term-1',
      annotationUuids: ['a-1'],
    });
  });

  it('criterion 6: the row leaves the table and the others stay', async () => {
    serve(3);
    deleting();
    renderTable();
    await ready();
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete instance in 1.2' }),
    );

    await confirm();

    await waitFor(() => expect(labels()).toEqual(['1.1', '1.3']));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('criterion 6: the passage text is not sent anywhere: only the annotation is named', async () => {
    serve(2);
    deleting();
    renderTable();
    await ready();
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete instance in 1.1' }),
    );

    await confirm();

    await waitFor(() => expect(mockRemoveInstances).toHaveBeenCalled());
    const args = mockRemoveInstances.mock.calls[0][0];
    expect(JSON.stringify(args)).not.toContain('bodhisattva');
    expect(args.annotationUuids).toEqual(['a-0']);
  });
});

describe('DEV-912 criterion 7: delete selected', () => {
  it('criterion 7: each row has a checkbox to select it', async () => {
    serve(3);
    renderTable();
    await ready();

    for (const label of ['1.1', '1.2', '1.3']) {
      const box = screen.getByRole('checkbox', {
        name: `Select instance in ${label}`,
      }) as HTMLInputElement;
      expect(box.checked).toBe(false);
    }
  });

  it('criterion 7: "Delete selected" counts the rows selected', async () => {
    serve(5);
    renderTable();
    await ready();

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select instance in 1.1' }),
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select instance in 1.3' }),
    );

    expect(
      screen.getByRole('button', { name: 'Delete selected (2)' }),
    ).toBeTruthy();
  });

  it('criterion 7: deleting the selected asks for confirmation with the count, and deletes nothing yet', async () => {
    serve(5);
    renderTable();
    await ready();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select instance in 1.1' }),
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select instance in 1.3' }),
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Delete selected (2)' }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toMatch(/\b2\b/);
    expect(mockRemoveInstances).not.toHaveBeenCalled();
  });

  it('criterion 7: confirming removes exactly the selected instances', async () => {
    serve(5);
    deleting();
    renderTable();
    await ready();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select instance in 1.1' }),
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select instance in 1.3' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete selected (2)' }),
    );

    await confirm();

    await waitFor(() => expect(mockRemoveInstances).toHaveBeenCalledTimes(1));
    const args = mockRemoveInstances.mock.calls[0][0];
    expect(args).toMatchObject({ workUuid: 'work-1', termUuid: 'term-1' });
    expect([...args.annotationUuids].sort()).toEqual(['a-0', 'a-2']);
    await waitFor(() => expect(labels()).toEqual(['1.2', '1.4', '1.5']));
  });

  it('criterion 7: cancelling the confirmation deletes nothing', async () => {
    serve(5);
    renderTable();
    await ready();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select instance in 1.1' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete selected (1)' }),
    );
    const dialog = await screen.findByRole('alertdialog');

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(mockRemoveInstances).not.toHaveBeenCalled();
    expect(labels()).toHaveLength(5);
  });

  it('criterion 7: select all selects every row on the current page', async () => {
    serve(120);
    renderTable();
    await ready();

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all on this page' }),
    );

    const boxes = screen
      .getAllByRole('checkbox')
      .filter((box) =>
        /^Select instance in/.test(box.getAttribute('aria-label') ?? ''),
      );
    expect(boxes).toHaveLength(PAGE);
    expect(boxes.every((box) => (box as HTMLInputElement).checked)).toBe(true);
    expect(
      screen.getByRole('button', { name: `Delete selected (${PAGE})` }),
    ).toBeTruthy();
  });

  it('criterion 7: select all deletes the page, not the rest of the term', async () => {
    serve(120);
    deleting();
    renderTable();
    await ready();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all on this page' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: `Delete selected (${PAGE})` }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toMatch(new RegExp(`\\b${PAGE}\\b`));

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() => expect(mockRemoveInstances).toHaveBeenCalledTimes(1));
    const { annotationUuids } = mockRemoveInstances.mock.calls[0][0];
    expect([...annotationUuids].sort()).toEqual(
      Array.from({ length: PAGE }, (_, i) => `a-${i}`).sort(),
    );
  });

  it('criterion 7: select all on a later page selects that page', async () => {
    serve(120);
    deleting();
    renderTable();
    await ready();
    await userEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Instance pages' }),
      ).getByRole('button', { name: /next/i }),
    );
    await waitFor(() => expect(labels()[0]).toBe('1.51'));

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all on this page' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: `Delete selected (${PAGE})` }),
    );
    await confirm();

    await waitFor(() => expect(mockRemoveInstances).toHaveBeenCalledTimes(1));
    const { annotationUuids } = mockRemoveInstances.mock.calls[0][0];
    expect(annotationUuids).toContain('a-50');
    expect(annotationUuids).toContain('a-99');
    expect(annotationUuids).not.toContain('a-0');
  });

  it('criterion 7: clearing the select-all box clears the selection', async () => {
    serve(5);
    renderTable();
    await ready();
    const all = screen.getByRole('checkbox', {
      name: 'Select all on this page',
    });

    await userEvent.click(all);
    await userEvent.click(all);

    for (const label of ['1.1', '1.5']) {
      const box = screen.getByRole('checkbox', {
        name: `Select instance in ${label}`,
      }) as HTMLInputElement;
      expect(box.checked).toBe(false);
    }
    expect(
      screen.queryByRole('button', { name: /^Delete selected \([1-9]/ }),
    ).toBeNull();
  });
});

describe('DEV-912 criterion 8: partial failure', () => {
  const failure = (n: number): Failure => ({
    passageUuid: `p-${n - 1}`,
    passageLabel: `1.${n}`,
    annotationUuids: [`a-${n - 1}`],
    error: 'deadlock detected',
  });

  const deleteAll = async (count: number) => {
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all on this page' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: `Delete selected (${count})` }),
    );
    await confirm();
  };

  it('criterion 8: the rows that were deleted leave, and the rows that failed stay', async () => {
    serve(3);
    deleting([failure(2)]);
    renderTable();
    await ready();

    await deleteAll(3);

    await waitFor(() => expect(labels()).toEqual(['1.2']));
  });

  it('criterion 8: the table names the passage that failed', async () => {
    serve(3);
    deleting([failure(2)]);
    const { container } = renderTable();
    await ready();

    await deleteAll(3);

    await waitFor(() => expect(labels()).toEqual(['1.2']));
    // Its row, and the account of the failure.
    expect(mentions(container, '1.2')).toBeGreaterThanOrEqual(2);
  });

  it('criterion 8: every passage that failed is named, and the ones deleted are not', async () => {
    serve(4);
    deleting([failure(1), failure(4)]);
    const { container } = renderTable();
    await ready();

    await deleteAll(4);

    await waitFor(() => expect(labels()).toEqual(['1.1', '1.4']));
    expect(mentions(container, '1.1')).toBeGreaterThanOrEqual(2);
    expect(mentions(container, '1.4')).toBeGreaterThanOrEqual(2);
    expect(mentions(container, '1.2')).toBe(0);
    expect(mentions(container, '1.3')).toBe(0);
  });

  it('criterion 8: the deletions that succeeded are not asked for again', async () => {
    serve(3);
    deleting([failure(2)]);
    renderTable();
    await ready();

    await deleteAll(3);

    await waitFor(() => expect(labels()).toEqual(['1.2']));
    expect(mockRemoveInstances).toHaveBeenCalledTimes(1);
  });

  it('criterion 8: a delete that fails everywhere keeps every row', async () => {
    serve(2);
    deleting([failure(1), failure(2)]);
    const { container } = renderTable();
    await ready();

    await deleteAll(2);

    await waitFor(() =>
      expect(mentions(container, '1.1')).toBeGreaterThanOrEqual(2),
    );
    expect(labels()).toEqual(['1.1', '1.2']);
  });
});

describe('DEV-912 criterion 9: open sessions see the deletion', () => {
  it('criterion 9: the passages the delete rewrote are handed to the editor to take in', async () => {
    serve(3);
    deleting();
    renderTable();
    await ready();
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete instance in 1.2' }),
    );

    await confirm();

    await waitFor(() => expect(applyReplacedPassages).toHaveBeenCalled());
    const result = await mockRemoveInstances.mock.results[0].value;
    expect(applyReplacedPassages).toHaveBeenCalledWith(result.passages);
  });

  it('criterion 9: a partial failure still hands over the passages that were rewritten', async () => {
    serve(3);
    deleting([
      {
        passageUuid: 'p-1',
        passageLabel: '1.2',
        annotationUuids: ['a-1'],
        error: 'deadlock detected',
      },
    ]);
    renderTable();
    await ready();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all on this page' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete selected (3)' }),
    );

    await confirm();

    await waitFor(() => expect(applyReplacedPassages).toHaveBeenCalled());
    const handed = applyReplacedPassages.mock.calls.flatMap(
      ([passages]) => passages as unknown as Array<{ uuid: string }>,
    );
    expect(handed.map((p) => p.uuid).sort()).toEqual(['p-0', 'p-2']);
  });

  it('criterion 9: nothing is handed over when nothing was deleted', async () => {
    serve(3);
    renderTable();
    await ready();
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete instance in 1.2' }),
    );
    const dialog = await screen.findByRole('alertdialog');

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    );

    expect(applyReplacedPassages).not.toHaveBeenCalled();
  });
});

describe('DEV-912 criterion 10: permission', () => {
  it('criterion 10: a user who may not edit sees the table and its rows', async () => {
    serve(3);
    renderTable(true);
    await ready();

    expect(labels()).toEqual(['1.1', '1.2', '1.3']);
    expect(screen.getByText(/3 instances/)).toBeTruthy();
  });

  it('criterion 10: a user who may not edit has no select controls', async () => {
    serve(3);
    renderTable(true);
    await ready();

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('criterion 10: a user who may not edit has no delete controls', async () => {
    serve(3);
    renderTable(true);
    await ready();

    expect(screen.queryAllByRole('button', { name: /delete/i })).toHaveLength(
      0,
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('criterion 10: outside any editor, as in the reader, the table is the same read-only table', async () => {
    serve(3);
    render(<GlossaryInstancesTable termUuid="term-1" onClose={jest.fn()} />);
    await ready();

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: /delete/i })).toHaveLength(
      0,
    );
  });

  it('criterion 10: a user who may edit has them', async () => {
    serve(3);
    renderTable(false);
    await ready();

    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: /delete instance in/i }),
    ).toHaveLength(3);
  });
});
