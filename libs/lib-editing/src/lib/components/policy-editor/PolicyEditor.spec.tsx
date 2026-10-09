import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import type { MarkdownEditorProps } from '../editor/markdown/MarkdownEditor';
import { createMemoryPolicySource } from './memory-policy-source';
import { PolicyEditor, type PolicyEditorProps } from './PolicyEditor';
import { policyVersion, type PolicySource } from './policy-source';
import type { PolicyRevision, PolicyWriteResult } from './policy-source';
import { act } from 'react';

/** MarkdownEditor's `onChange`, including its `exact` argument. */
type MockOnChange = (markdown: string, dirty: boolean, exact: boolean) => void;

// A textarea stands in for the editor, which has its own spec. Text
// containing "inexact" reports that it would not serialize exactly.
jest.mock('../editor/markdown/MarkdownEditor', () => ({
  MarkdownEditor: ({ source, editable, onChange }: MarkdownEditorProps) =>
    jest.requireActual('react').createElement('textarea', {
      'aria-label': 'Policy',
      defaultValue: source,
      readOnly: !editable,
      onChange: ({ target: { value } }: { target: { value: string } }) =>
        (onChange as MockOnChange)(
          value,
          value !== source,
          !value.includes('inexact'),
        ),
    }),
}));

// jsdom has neither; policyVersion needs both.
Object.assign(globalThis, { TextEncoder });
Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle });

// jsdom has no ResizeObserver; the resizable policy list needs one.
globalThis.ResizeObserver ??= class {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
};

const setup = (props: Partial<PolicyEditorProps> = {}) => {
  const source = createMemoryPolicySource({
    a: 'Old\n',
    b: 'B\n',
    'x/b': 'XB\n',
  });
  for (const key of Object.keys(source) as (keyof PolicySource)[]) {
    jest.spyOn(source, key);
  }
  const onSaved = jest.fn();
  const { rerender, unmount } = render(
    <PolicyEditor
      source={source}
      permissions={{ read: true, edit: true, admin: false }}
      onSaved={onSaved}
      {...props}
    />,
  );
  return { source, onSaved, rerender, unmount };
};

const permissions = { read: true, edit: true, admin: false };

/** A promise settled by the test, to hold a source call in flight. */
const deferred = <T = PolicyWriteResult,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => (resolve = settle));
  return { promise, resolve: (value: T) => act(async () => resolve(value)) };
};

const stamp = (revision: PolicyRevision) =>
  new Date(revision.archivedAt).toLocaleString();

const openPolicy = async (name: string) => {
  fireEvent.click(await screen.findByRole('button', { name }));
  await screen.findByRole('heading', { name });
};

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText('Policy'), { target: { value } });

const text = () =>
  (screen.getByLabelText('Policy') as HTMLTextAreaElement).value;

const saveButton = () => screen.getByRole('button', { name: 'Save' });

const click = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

const admin = { read: true, edit: true, admin: true };

/** Saves "Mine" over policy `a` after someone else saved "Theirs". */
const conflictOnSave = async () => {
  const view = setup();
  await openPolicy('a');
  await view.source.write({ name: 'a', content: 'Theirs\n' });
  type('Mine\n');
  fireEvent.click(saveButton());
  const dialog = await screen.findByRole('dialog', {
    name: 'This policy changed after you opened it',
  });
  return { ...view, dialog };
};

/** Opens policy `a` as an admin and opens the `action` dialog. */
const openDialog = async (
  action: 'Delete' | 'Rename',
  props: Partial<PolicyEditorProps> = {},
) => {
  const view = setup({ permissions: admin, ...props });
  await openPolicy('a');
  click(action);
  const dialog = await screen.findByRole('dialog', {
    name: action === 'Delete' ? 'Delete a?' : 'Rename a',
  });
  return { ...view, dialog };
};

const renameTo = (name: string) => {
  fireEvent.input(screen.getByLabelText('New name'), {
    target: { value: name },
  });
  // The header's Rename button is hidden behind the modal dialog.
  click('Rename');
};

/** Opens policy `a`, which has one archived revision ("Old"), and shows that revision. */
const viewRevision = async (props: Partial<PolicyEditorProps> = {}) => {
  const view = setup(props);
  await view.source.write({ name: 'a', content: 'A\n' });
  await openPolicy('a');
  const [revision] = await view.source.history('a');
  fireEvent.click(await screen.findByRole('button', { name: stamp(revision) }));
  await screen.findByRole('region', { name: 'Revision' });
  return { ...view, revision };
};

describe('PolicyEditor', () => {
  it('saves only a changed document that serializes exactly', async () => {
    const { source } = setup();
    await openPolicy('a');
    expect(saveButton()).toHaveProperty('disabled', true);

    type('Mine, inexact\n');
    expect(saveButton()).toHaveProperty('disabled', true);
    fireEvent.click(saveButton());
    type('Old\n');
    expect(saveButton()).toHaveProperty('disabled', true);

    type('Mine\n');
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(text()).toBe('Old\n');

    await openPolicy('b');
    expect(source.write).not.toHaveBeenCalled();
  });

  it('asks before discarding unsaved changes to open another policy', async () => {
    const onDirtyChange = jest.fn();
    const { source } = setup({ onDirtyChange });
    await openPolicy('a');
    type('Mine\n');

    click('b');
    const dialog = await screen.findByRole('dialog', {
      name: 'Discard unsaved changes?',
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Keep editing' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('heading', { name: 'a' })).toBeTruthy();
    expect(text()).toBe('Mine\n');

    click('b');
    fireEvent.click(
      within(
        await screen.findByRole('dialog', { name: 'Discard unsaved changes?' }),
      ).getByRole('button', { name: 'Discard changes' }),
    );
    await screen.findByRole('heading', { name: 'b' });
    expect(text()).toBe('B\n');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(source.write).not.toHaveBeenCalled();
  });

  it('opens another policy while one is still loading', async () => {
    const { source } = setup();
    const read = deferred<Awaited<ReturnType<PolicySource['read']>>>();
    jest.mocked(source.read).mockReturnValueOnce(read.promise);
    fireEvent.click(await screen.findByRole('button', { name: 'a' }));
    expect(screen.getByText('Loading policy…')).toBeTruthy();

    const other = screen.getByRole('button', { name: 'b' });
    expect(other).toHaveProperty('disabled', false);
    await openPolicy('b');
    await read.resolve({ name: 'a', content: 'Stale\n', version: 'v' });
    expect(screen.getByRole('heading', { name: 'b' })).toBeTruthy();
  });

  it('saves against the loaded version, then against the saved one', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { source, onSaved } = setup();
    // A host that throws does not stop the editor taking the saved version.
    onSaved.mockImplementationOnce(() => {
      throw new Error('host');
    });
    await openPolicy('a');

    for (const [times, content] of [
      [1, 'A2\n'],
      [2, 'A3\n'],
    ] as const) {
      type(content);
      fireEvent.click(saveButton());
      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(times));
    }

    const writes = jest
      .mocked(source.write)
      .mock.calls.map(([{ content, expectedVersion }]) => [
        content,
        expectedVersion,
      ]);
    expect(writes).toEqual([
      ['A2\n', await policyVersion('Old\n')],
      ['A3\n', await policyVersion('A2\n')],
    ]);
    expect(onSaved).toHaveBeenLastCalledWith({
      ok: true,
      name: 'a',
      version: await policyVersion('A3\n'),
      created: false,
      archivedPath: expect.any(String),
    });
    expect(saveButton()).toHaveProperty('disabled', true);
  });

  it('keeps typing made while a save is in flight', async () => {
    const onDirtyChange = jest.fn();
    const { source, unmount } = setup({ onDirtyChange });
    const [write, version] = [deferred(), await policyVersion('A2\n')];
    jest.mocked(source.write).mockReturnValueOnce(write.promise);
    await openPolicy('a');

    type('A2\n');
    fireEvent.click(saveButton());
    type('A3\n');
    const discard = screen.getByRole('button', { name: 'Discard changes' });
    expect(discard).toHaveProperty('disabled', true);
    await write.resolve({ ok: true, version, created: false });

    expect(text()).toBe('A3\n');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(saveButton());
    expect(source.write).toHaveBeenLastCalledWith({
      name: 'a',
      content: 'A3\n',
      expectedVersion: version,
    });
    unmount();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('frees the list for a new source while a save is in flight', async () => {
    const { source, rerender } = setup();
    jest.mocked(source.write).mockReturnValueOnce(deferred().promise);
    await openPolicy('a');
    type('Mine\n');
    fireEvent.click(saveButton());
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy();

    rerender(
      <PolicyEditor
        source={createMemoryPolicySource({ c: 'C\n' })}
        permissions={permissions}
      />,
    );
    expect(await screen.findByRole('button', { name: 'c' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('shows a stale save as a diff and reloads the stored policy', async () => {
    const { dialog } = await conflictOnSave();
    expect(dialog.querySelector('del')?.textContent).toContain('Theirs');
    expect(dialog.querySelector('ins')?.textContent).toContain('Mine');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reload' }));

    await waitFor(() => expect(text()).toBe('Theirs\n'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(saveButton()).toHaveProperty('disabled', true);
  });

  it('overwrites a stale save against the stored version', async () => {
    const { source, onSaved, dialog } = await conflictOnSave();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Overwrite' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(source.write).toHaveBeenLastCalledWith({
      name: 'a',
      content: 'Mine\n',
      expectedVersion: await policyVersion('Theirs\n'),
    });
    expect((await source.read('a'))?.content).toBe('Mine\n');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('diffs a save conflict against the draft an overwrite would write', async () => {
    const { source } = setup();
    await openPolicy('a');
    await source.write({ name: 'a', content: 'Theirs\n' });
    const held = deferred();
    jest.mocked(source.write).mockReturnValueOnce(held.promise);
    type('Mine\n');
    fireEvent.click(saveButton());
    type('Mine, and later\n');
    await held.resolve({
      ok: false,
      reason: 'conflict',
      current: (await source.read('a'))!,
    });

    const dialog = await screen.findByRole('dialog', {
      name: 'This policy changed after you opened it',
    });
    expect(dialog.querySelector('ins')?.textContent).toContain(
      'Mine, and later',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Overwrite' }));

    await waitFor(async () =>
      expect((await source.read('a'))?.content).toBe('Mine, and later\n'),
    );
  });

  it('cannot overwrite with a draft that no longer saves exactly', async () => {
    const { dialog } = await conflictOnSave();
    type('inexact\n');

    expect(
      within(dialog).getByRole('button', { name: 'Overwrite' }),
    ).toHaveProperty('disabled', true);
    expect(within(dialog).getByText(/can no longer be saved/)).toBeTruthy();

    type('Mine again\n');
    expect(
      within(dialog).getByRole('button', { name: 'Overwrite' }),
    ).toHaveProperty('disabled', false);
  });

  it('overwrites a stale restore with the revision', async () => {
    const { source, revision } = await viewRevision();
    await source.write({ name: 'a', content: 'Theirs\n' });
    click('Restore');
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('ins')?.textContent).toContain('Old');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Overwrite' }));

    await waitFor(() => expect(text()).toBe('Old\n'));
    expect(source.restore).toHaveBeenLastCalledWith({
      name: 'a',
      revisionPath: revision.path,
      expectedVersion: await policyVersion('Theirs\n'),
    });
  });

  it('keeps the draft when the conflict dialog is dismissed', async () => {
    const { source } = await conflictOnSave();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(text()).toBe('Mine\n');
    expect(source.write).toHaveBeenCalledTimes(2);
  });

  it('deletes after confirming, clearing the selection', async () => {
    const onDeleted = jest.fn();
    const { source, dialog } = await openDialog('Delete', { onDeleted });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Select a policy to open it.')).toBeTruthy();
    expect(source.delete).toHaveBeenCalledWith({
      name: 'a',
      expectedVersion: await policyVersion('Old\n'),
    });
    expect(onDeleted).toHaveBeenCalledWith({
      name: 'a',
      archivedPath: expect.any(String),
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'a' })).toBeNull(),
    );
  });

  it('cancels a delete with Escape', async () => {
    const { source } = await openDialog('Delete');
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(source.delete).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'a' })).toBeTruthy();
  });

  it.each([
    ['forbidden', 'You do not have permission to do that.'],
    ['not-found', 'This policy no longer exists.'],
    ['error', 'Something went wrong. boom'],
  ] as const)('shows a failed delete (%s)', async (reason, message) => {
    const { source, dialog } = await openDialog('Delete');
    jest
      .mocked(source.delete)
      .mockResolvedValueOnce({ ok: false, reason, message: 'boom' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect(screen.queryByRole('dialog')).toBeNull();
    // A policy that is gone stops being shown; any other failure keeps it.
    expect(!!screen.queryByRole('heading', { name: 'a' })).toBe(
      reason !== 'not-found',
    );
  });

  it.each(['Delete', 'Rename'] as const)(
    'repeats a refused %s over the stored version',
    async (action) => {
      const { source, dialog } = await openDialog(action);
      await source.write({ name: 'a', content: 'Theirs\n' });
      if (action === 'Rename') {
        renameTo('x/a');
      } else {
        fireEvent.click(within(dialog).getByRole('button', { name: action }));
      }
      const conflict = await screen.findByRole('dialog', {
        name: 'This policy changed after you opened it',
      });
      fireEvent.click(
        within(conflict).getByRole('button', { name: `${action} anyway` }),
      );

      await waitFor(async () => expect(await source.read('a')).toBeUndefined());
      const method = action === 'Delete' ? source.delete : source.rename;
      expect(method).toHaveBeenLastCalledWith(
        expect.objectContaining({
          expectedVersion: await policyVersion('Theirs\n'),
        }),
      );
    },
  );

  it('renames to a valid, free name and opens it', async () => {
    const onRenamed = jest.fn();
    const { source } = await openDialog('Rename', { onRenamed });

    renameTo('not a name');
    expect(screen.getByRole('alert').textContent).toMatch(/^Use folder\/name/);
    renameTo('a');
    expect(screen.getByRole('alert').textContent).toMatch(/^Use folder\/name/);
    expect(source.rename).not.toHaveBeenCalled();

    renameTo('x/b');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'A policy with that name already exists.',
    );
    expect(screen.getByRole('dialog', { name: 'Rename a' })).toBeTruthy();

    renameTo('x/a');
    expect(await screen.findByRole('heading', { name: 'x/a' })).toBeTruthy();
    expect(source.rename).toHaveBeenLastCalledWith({
      from: 'a',
      to: 'x/a',
      expectedVersion: await policyVersion('Old\n'),
    });
    expect(onRenamed).toHaveBeenCalledWith({
      from: 'a',
      to: 'x/a',
      archivedPath: expect.any(String),
    });
    expect(await screen.findByRole('button', { name: 'x/a' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'a' })).toBeNull();
  });

  it('reopens the rename dialog when a repeated rename finds the name taken', async () => {
    const { source } = await openDialog('Rename');
    await source.write({ name: 'a', content: 'Theirs\n' });
    renameTo('x/c');
    const conflict = await screen.findByRole('dialog', {
      name: 'This policy changed after you opened it',
    });
    await source.write({ name: 'x/c', content: 'Taken\n' });
    fireEvent.click(
      within(conflict).getByRole('button', { name: 'Rename anyway' }),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'A policy with that name already exists.',
    );
    expect(screen.getByRole('dialog', { name: 'Rename a' })).toBeTruthy();
  });

  it('starts the rename field with the current name', async () => {
    await openDialog('Rename');
    expect((screen.getByLabelText('New name') as HTMLInputElement).value).toBe(
      'a',
    );
  });

  it.each(['Delete', 'Rename'] as const)(
    'locks the editor while a repeated %s is in flight',
    async (action) => {
      const { source } = await openDialog(action);
      await source.write({ name: 'a', content: 'Theirs\n' });
      if (action === 'Rename') {
        renameTo('x/a');
      } else {
        click('Delete');
      }
      const conflict = await screen.findByRole('dialog', {
        name: 'This policy changed after you opened it',
      });
      const held = deferred<{ ok: true; archivedPath: string }>();
      jest
        .mocked(action === 'Delete' ? source.delete : source.rename)
        .mockReturnValueOnce(held.promise);
      fireEvent.click(
        within(conflict).getByRole('button', { name: `${action} anyway` }),
      );

      await waitFor(() =>
        expect(screen.getByLabelText('Policy')).toHaveProperty(
          'readOnly',
          true,
        ),
      );
      await held.resolve({ ok: true, archivedPath: 'p' });
    },
  );

  it('closes a conflict dialog and refuses its overwrite when edit is revoked', async () => {
    const { source, rerender } = await conflictOnSave();
    rerender(
      <PolicyEditor
        source={source}
        permissions={{ read: true, edit: false, admin: false }}
        initialName="a"
      />,
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(source.write).toHaveBeenCalledTimes(2);
  });

  it.each(['Delete', 'Rename'] as const)(
    'closes the %s dialog and refuses it when admin is revoked',
    async (action) => {
      const { source, rerender } = await openDialog(action);
      rerender(
        <PolicyEditor
          source={source}
          permissions={{ read: true, edit: true, admin: false }}
          initialName="a"
        />,
      );

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(source.delete).not.toHaveBeenCalled();
      expect(source.rename).not.toHaveBeenCalled();
    },
  );

  it('forgets a refused rename name when the dialog is reopened', async () => {
    await openDialog('Rename');
    renameTo('x/b');
    expect((await screen.findByRole('alert')).textContent).toMatch(/exists/);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    click('Rename');
    await screen.findByRole('dialog', { name: 'Rename a' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['Delete', 'Rename'] as const)(
    'keeps the %s dialog open while it is in flight',
    async (action) => {
      const { source } = await openDialog(action);
      const held = deferred<{ ok: true; archivedPath: string }>();
      jest
        .mocked(action === 'Delete' ? source.delete : source.rename)
        .mockReturnValueOnce(held.promise);
      if (action === 'Rename') {
        renameTo('x/a');
      } else {
        click('Delete');
      }

      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Escape',
      });
      expect(screen.getByRole('dialog')).toBeTruthy();

      await held.resolve({ ok: true, archivedPath: 'p' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    },
  );

  it('shows only the latest policy list when responses arrive out of order', async () => {
    const { source } = await openDialog('Delete');
    // The list refreshed by the first delete is answered last.
    const stale = deferred<string[]>();
    jest.mocked(source.list).mockReturnValueOnce(stale.promise);
    click('Delete');
    await screen.findByText('Select a policy to open it.');

    await openPolicy('b');
    click('Delete');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'b' })).toBeNull(),
    );

    await stale.resolve(['a', 'b']);
    expect(screen.queryByRole('button', { name: 'a' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'b' })).toBeNull();
  });

  it('drops a delete that settles after another source opens', async () => {
    const { source, dialog, rerender } = await openDialog('Delete');
    const removal = deferred<{ ok: true; archivedPath: string }>();
    jest.mocked(source.delete).mockReturnValueOnce(removal.promise);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    rerender(
      <PolicyEditor
        source={createMemoryPolicySource({ c: 'C\n' })}
        permissions={admin}
        initialName="c"
      />,
    );
    await screen.findByRole('heading', { name: 'c' });
    await removal.resolve({ ok: true, archivedPath: 'p' });
    expect(screen.getByRole('heading', { name: 'c' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'c' })).toBeTruthy();
  });

  it('refuses to delete or rename while there are unsaved changes', async () => {
    setup({ permissions: admin });
    await openPolicy('a');
    type('Mine\n');
    for (const name of ['Delete', 'Rename']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveProperty('disabled', true);
      expect(button.getAttribute('aria-describedby')).toBe(
        screen.getByRole('status').id,
      );
    }
  });

  it.each([
    ['forbidden', 'You do not have permission to do that.'],
    ['not-found', 'This policy no longer exists.'],
    ['error', 'Something went wrong. boom'],
    ['rejected', 'Something went wrong. Error: boom'],
    ['thrown', 'Something went wrong. Error: boom'],
  ] as const)('shows a failed save (%s)', async (reason, message) => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { source, onSaved } = setup();
    jest.mocked(source.write).mockImplementation(() => {
      if (reason === 'thrown') {
        throw new Error('boom');
      }
      return reason === 'rejected'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ ok: false, reason, message: 'boom' });
    });
    await openPolicy('a');

    type('Mine\n');
    fireEvent.click(saveButton());

    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
    expect(saveButton()).toHaveProperty('disabled', false);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('shows a revision and restores it as a new write', async () => {
    const { source, onSaved, revision } = await viewRevision();
    expect(
      screen.getByRole('region', { name: 'Revision' }).textContent,
    ).toContain('Old');

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => expect(text()).toBe('Old\n'));
    expect(source.restore).toHaveBeenCalledWith({
      name: 'a',
      revisionPath: revision.path,
      expectedVersion: await policyVersion('A\n'),
    });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'a', restoredFrom: revision.path }),
    );
  });

  it('drops history and revisions that arrive after another policy opens', async () => {
    const { source } = setup();
    await source.write({ name: 'a', content: 'A\n' });
    const [revision] = await source.history('a');
    const history = deferred<PolicyRevision[]>();
    jest.mocked(source.history).mockReturnValueOnce(history.promise);
    await openPolicy('a');
    await openPolicy('b');
    await history.resolve([revision]);
    expect(screen.queryByRole('button', { name: stamp(revision) })).toBeNull();

    const read = deferred<{ revision: PolicyRevision; content: string }>();
    jest.mocked(source.readRevision).mockReturnValueOnce(read.promise);
    await openPolicy('a');
    fireEvent.click(
      await screen.findByRole('button', { name: stamp(revision) }),
    );
    await openPolicy('b');
    await read.resolve({ revision, content: 'Old\n' });
    expect(screen.queryByRole('region', { name: 'Revision' })).toBeNull();
  });

  it('shows only the last revision asked for, and drops it on discard', async () => {
    const { source } = setup();
    await source.write({ name: 'a', content: 'A\n' });
    await source.write({ name: 'a', content: 'A2\n' });
    const [newer, older] = await source.history('a');
    const region = () => screen.queryByRole('region', { name: 'Revision' });
    // Newest first; both may carry the same stamp.
    const rows = async () =>
      (await screen.findAllByRole('button')).filter((button) =>
        [stamp(newer), stamp(older)].includes(button.textContent ?? ''),
      );
    const late = deferred<{ revision: PolicyRevision; content: string }>();
    jest.mocked(source.readRevision).mockReturnValueOnce(late.promise);
    await openPolicy('a');

    await waitFor(async () => expect(await rows()).toHaveLength(2));
    fireEvent.click((await rows())[1]);
    fireEvent.click((await rows())[0]);
    await waitFor(() => expect(region()?.textContent).toContain('A\n'));
    await late.resolve({ revision: older, content: 'Old\n' });
    expect(region()?.textContent).not.toContain('Old');

    const pending = deferred<{ revision: PolicyRevision; content: string }>();
    jest.mocked(source.readRevision).mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Back to current' }));
    fireEvent.click((await rows())[1]);
    type('Mine\n');
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    await pending.resolve({ revision: older, content: 'Old\n' });
    expect(region()).toBeNull();
  });

  it('locks the policy during a restore and drops it once another source opens', async () => {
    const { source, rerender } = await viewRevision();
    const restore = deferred();
    jest.mocked(source.restore).mockReturnValueOnce(restore.promise);

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    // The save button does not claim a restore as a save.
    for (const name of ['Restore', 'Save']) {
      expect(screen.getByRole('button', { name })).toHaveProperty(
        'disabled',
        true,
      );
    }
    expect(screen.getByRole('button', { name: 'b' })).toHaveProperty(
      'disabled',
      false,
    );

    rerender(
      <PolicyEditor
        source={createMemoryPolicySource()}
        permissions={permissions}
      />,
    );
    await restore.resolve({ ok: true, version: 'v', created: false });
    expect(await screen.findByText('Select a policy to open it.')).toBeTruthy();
    expect(source.read).toHaveBeenCalledTimes(1);
  });

  it('locks restore while there are unsaved changes, and says why', async () => {
    const { source } = setup();
    await source.write({ name: 'a', content: 'A\n' });
    await openPolicy('a');
    const [revision] = await source.history('a');
    type('Mine\n');
    fireEvent.click(
      await screen.findByRole('button', { name: stamp(revision) }),
    );
    await screen.findByRole('region', { name: 'Revision' });

    const restore = screen.getByRole('button', { name: 'Restore' });
    expect(restore).toHaveProperty('disabled', true);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Save or discard your changes first.');
    expect(restore.getAttribute('aria-describedby')).toBe(status.id);
  });

  it('opens another policy without asking once edit is revoked', async () => {
    const { rerender, source } = setup();
    await openPolicy('a');
    type('Mine\n');
    expect(screen.getByRole('status').textContent).toBe(
      'Save or discard your changes first.',
    );

    rerender(
      <PolicyEditor
        source={source}
        permissions={{ read: true, edit: false, admin: false }}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe('');
    await openPolicy('b');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a missing policy as not found', async () => {
    setup({ initialName: 'missing' });
    expect(await screen.findByText('Policy not found.')).toBeTruthy();
  });

  it('shows nothing without read permission', () => {
    const { source } = setup({
      permissions: { read: false, edit: true, admin: true },
    });
    expect(screen.getByText(/do not have permission to read/)).toBeTruthy();
    expect(source.list).not.toHaveBeenCalled();
  });

  it.each([
    ['read', { read: true, edit: false, admin: false }, false, false],
    ['edit', { read: true, edit: true, admin: false }, true, false],
    [
      'admin without edit',
      { read: true, edit: false, admin: true },
      false,
      true,
    ],
    ['admin', admin, true, true],
  ])(
    'renders only the controls %s allows',
    async (_, permissions, canEdit, canAdmin) => {
      await viewRevision({ permissions });

      for (const [control, allowed] of [
        ['Save', canEdit],
        ['Restore', canEdit],
        ['Delete', canAdmin],
        ['Rename', canAdmin],
      ] as const) {
        expect(screen.queryByRole('button', { name: control }) !== null).toBe(
          allowed,
        );
      }
      expect(screen.getByLabelText('Policy')).toHaveProperty(
        'readOnly',
        !canEdit,
      );
    },
  );
});
