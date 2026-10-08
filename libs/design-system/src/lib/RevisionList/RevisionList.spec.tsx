import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RevisionList, type RevisionListItem } from './RevisionList';

interface Revision {
  key: string;
  name: string;
  at: string;
  author?: string;
}

const revisions: Revision[] = [
  {
    key: 'r2',
    name: 'Revision 2',
    at: '2026-08-02T10:00:00.000Z',
    author: 'Dawa',
  },
  { key: 'r1', name: 'Revision 1', at: '2026-08-01T10:00:00.000Z' },
];

const toRevision = (revision: Revision): RevisionListItem => ({
  id: revision.key,
  label: revision.name,
  timestamp: revision.at,
  meta: revision.author,
});

const toggle = () =>
  userEvent.click(screen.getByRole('button', { name: /History/ }));

describe('RevisionList', () => {
  it('starts collapsed when there is a list, with the count in the header', async () => {
    render(
      <RevisionList
        title="History"
        items={revisions}
        toRevision={toRevision}
      />,
    );

    expect(screen.getByText('(2)')).toBeTruthy();
    expect(screen.queryByText('Revision 2')).toBeNull();

    await toggle();
    expect(screen.getByText('Revision 2')).toBeTruthy();
    expect(screen.getByText(/Dawa/)).toBeTruthy();
  });

  it('starts open on an empty or unavailable history, with the caller messages', () => {
    const { rerender } = render(
      <RevisionList
        title="History"
        items={[]}
        toRevision={toRevision}
        emptyMessage="Nothing saved yet."
        unavailableMessage="Could not load."
      />,
    );
    expect(screen.getByText('Nothing saved yet.')).toBeTruthy();
    expect(screen.queryByText('(0)')).toBeNull();

    rerender(
      <RevisionList
        title="History"
        items={[]}
        toRevision={toRevision}
        unavailable
        emptyMessage="Nothing saved yet."
        unavailableMessage="Could not load."
      />,
    );
    expect(screen.getByText('Could not load.')).toBeTruthy();
    expect(screen.queryByText('Nothing saved yet.')).toBeNull();
  });

  it('honours a controlled open state and reports toggles', async () => {
    const onOpenChange = jest.fn();
    render(
      <RevisionList
        title="History"
        items={revisions}
        toRevision={toRevision}
        open
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText('Revision 1')).toBeTruthy();
    await toggle();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Still open: the caller owns the state and has not changed it.
    expect(screen.getByText('Revision 1')).toBeTruthy();
  });

  it('renders rows as plain content when nothing is selectable', () => {
    render(
      <RevisionList
        title="History"
        items={revisions}
        toRevision={toRevision}
        defaultOpen
      />,
    );

    // Only the header toggle is a button.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('makes rows selectable buttons and marks the selected one', async () => {
    const onSelect = jest.fn();
    render(
      <RevisionList
        title="History"
        items={revisions}
        toRevision={toRevision}
        defaultOpen
        selectedId="r1"
        onSelect={onSelect}
      />,
    );

    const first = screen.getByRole('button', { name: /Revision 2/ });
    const second = screen.getByRole('button', { name: /Revision 1/ });
    expect(second.getAttribute('aria-current')).toBe('true');
    expect(first.getAttribute('aria-current')).toBeNull();

    await userEvent.click(first);
    expect(onSelect).toHaveBeenCalledWith(revisions[0]);

    // Reachable and operable from the keyboard.
    second.focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith(revisions[1]);
  });

  it('marks the selected row in a read-only list', () => {
    render(
      <RevisionList
        title="History"
        items={revisions}
        toRevision={toRevision}
        defaultOpen
        selectedId="r2"
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    const current = document.querySelectorAll('[aria-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('Revision 2');
  });

  it('treats empty slot values as absent', () => {
    render(
      <RevisionList
        title="History"
        items={[{ id: 'r0' }]}
        toRevision={({ id }) => ({
          id,
          label: 'Revision 0',
          timestamp: '',
          meta: 'Dawa',
          body: '',
        })}
        renderActions={() => ''}
        defaultOpen
      />,
    );

    // No "Invalid Date", no separator before the meta, no empty wrappers.
    const row = screen.getByText('Revision 0').closest('li');
    expect(row?.textContent).toBe('Revision 0Dawa');
    expect(row?.children).toHaveLength(1);
  });

  it('renders per-row actions outside the selectable row', async () => {
    const onRestore = jest.fn();
    const onSelect = jest.fn();
    render(
      <RevisionList
        title="History"
        items={revisions}
        toRevision={toRevision}
        defaultOpen
        onSelect={onSelect}
        renderActions={(revision) => (
          <button type="button" onClick={() => onRestore(revision.key)}>
            {`Restore ${revision.name}`}
          </button>
        )}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Restore Revision 1' }),
    );
    expect(onRestore).toHaveBeenCalledWith('r1');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('uses the caller timestamp format', () => {
    render(
      <RevisionList
        title="History"
        items={revisions}
        toRevision={toRevision}
        defaultOpen
        formatTimestamp={(timestamp) => `at ${String(timestamp).slice(0, 10)}`}
      />,
    );

    expect(screen.getByText(/at 2026-08-02 · Dawa/)).toBeTruthy();
    expect(screen.getByText('at 2026-08-01')).toBeTruthy();
  });
});
