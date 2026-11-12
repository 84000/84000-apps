/**
 * Acceptance tests for DEV-883 delete criteria 8 and 9, the menu half: the
 * glossary row's label menu has "Delete"; choosing it asks for confirmation,
 * listing the passages that have instances of the entry with a count; Delete
 * confirms and Cancel changes nothing.
 *
 * Written from the spec (TASK.md, CONTRACT.md), not the implementation. Only
 * data-access is faked, at the module boundary.
 */
import { useState } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { GlossaryRowMenu } from './GlossaryRowMenu';
import {
  citingPassage,
  entryOf,
  glossaryFake,
  type GlossaryFake,
} from './glossary-work.fixture';

// See PassageStackController.spec.ts: building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

let fake: GlossaryFake;
const mockExcerpts = (args: { uuid: string }) => fake.excerpts(args);

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getGlossaryTermExcerpts: (args: { uuid: string }) => mockExcerpts(args),
  createBrowserClient: () => ({}),
}));

const UUID = 'g7';
const TARGET = {
  uuid: UUID,
  rect: { top: 100, left: 40, width: 120, height: 24 },
};

const makeController = () => ({
  getMeta: jest.fn((uuid: string) => ({
    uuid,
    label: 'g.7',
    type: 'glossary',
  })),
  getGlossaryEntry: jest.fn(() =>
    entryOf({ uuid: UUID, termNumber: 7, definition: null, english: 'karma' }),
  ),
  deleteGlossaryEntry: jest.fn(async () => ({ deleted: true as const })),
});

/** The menu as the stack mounts it: open while it has a target, closing clears it. */
const Harness = ({
  controller,
  onClose,
}: {
  controller: ReturnType<typeof makeController>;
  onClose: () => void;
}) => {
  const [target, setTarget] = useState<typeof TARGET | null>(TARGET);
  return (
    <GlossaryRowMenu
      controller={controller as never}
      target={target}
      onClose={() => {
        onClose();
        setTarget(null);
      }}
    />
  );
};

const chooseDelete = async () => {
  fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }));
  return screen.findByRole('dialog');
};

/** Waits for the dialog to list the first passage. */
const listed = (dialog: HTMLElement) =>
  waitFor(() => expect(dialog.textContent).toMatch(/1\.17/));

beforeEach(() => {
  fake = glossaryFake([]);
  fake.citing.set(UUID, [
    citingPassage('p-a', '1.17', 4),
    citingPassage('p-b', '1.23', 1),
  ]);
});

describe('criterion 8: Delete from the row menu', () => {
  it('criterion 8: the label menu offers Copy Link and Delete', async () => {
    render(<Harness controller={makeController()} onClose={jest.fn()} />);

    expect(
      await screen.findByRole('menuitem', { name: /copy link/i }),
    ).toBeTruthy();
    expect(
      await screen.findByRole('menuitem', { name: /delete/i }),
    ).toBeTruthy();
  });

  it('criterion 8: the menu is not drawn while it has no target', () => {
    render(
      <GlossaryRowMenu
        controller={makeController() as never}
        target={null}
        onClose={jest.fn()}
      />,
    );

    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('criterion 8: choosing Delete closes the menu and asks first, deleting nothing', async () => {
    const controller = makeController();
    const onClose = jest.fn();
    render(<Harness controller={controller} onClose={onClose} />);

    const dialog = await chooseDelete();

    expect(onClose).toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(controller.deleteGlossaryEntry).not.toHaveBeenCalled();
  });

  it('criterion 8: the confirmation lists the passages with instances of the entry', async () => {
    render(<Harness controller={makeController()} onClose={jest.fn()} />);

    const dialog = await chooseDelete();

    await listed(dialog);
    expect(dialog.textContent).toMatch(/1\.23/);
    expect(fake.excerpts).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: UUID }),
    );
  });

  it('criterion 8: the confirmation gives the count of passages', async () => {
    render(<Harness controller={makeController()} onClose={jest.fn()} />);

    const dialog = await chooseDelete();
    await listed(dialog);

    // Two passages cite the entry (and none of the labels above is a bare 2).
    expect(dialog.textContent).toMatch(/\b2\b/);
  });

  it('criterion 8: the count is of all the passages, not only the ones listed', async () => {
    fake.excerpts.mockResolvedValue({
      items: [citingPassage('p-a', '1.17', 4), citingPassage('p-b', '1.23', 1)],
      totalCount: 40,
      nextCursor: 'more',
      hasMore: true,
    });
    render(<Harness controller={makeController()} onClose={jest.fn()} />);

    const dialog = await chooseDelete();
    await listed(dialog);

    expect(dialog.textContent).toMatch(/\b40\b/);
  });

  it('criterion 8: an entry no passage cites still asks first', async () => {
    fake.citing.clear();
    const controller = makeController();
    render(<Harness controller={controller} onClose={jest.fn()} />);

    const dialog = await chooseDelete();

    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(controller.deleteGlossaryEntry).not.toHaveBeenCalled();
  });
});

describe('criterion 9: confirm or cancel', () => {
  it('criterion 9: confirming deletes the entry, handing over the client and the loaded passages', async () => {
    const controller = makeController();
    render(<Harness controller={controller} onClose={jest.fn()} />);
    const dialog = await chooseDelete();
    await listed(dialog);

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    });

    expect(controller.deleteGlossaryEntry).toHaveBeenCalledTimes(1);
    expect(controller.deleteGlossaryEntry).toHaveBeenCalledWith(
      UUID,
      expect.objectContaining({
        client: expect.anything(),
        passages: expect.any(Array),
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('criterion 9: cancelling closes the dialog and deletes nothing', async () => {
    const controller = makeController();
    render(<Harness controller={controller} onClose={jest.fn()} />);
    const dialog = await chooseDelete();
    await listed(dialog);

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(controller.deleteGlossaryEntry).not.toHaveBeenCalled();
  });
});
