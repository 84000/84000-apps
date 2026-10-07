import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const setup = (props: Partial<PolicyEditorProps> = {}) => {
  const source = createMemoryPolicySource({ a: 'Old\n', b: 'B\n' });
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

    // Unsaved changes are discarded before opening another policy.
    type('Mine\n');
    const other = screen.getByRole('button', { name: 'b' });
    expect(other).toHaveProperty('disabled', true);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Save or discard your changes first.');
    expect(other.getAttribute('aria-describedby')).toBe(status.id);
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(text()).toBe('Old\n');
    expect(other).toHaveProperty('disabled', false);

    await openPolicy('b');
    expect(source.write).not.toHaveBeenCalled();
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

  it('refuses a stale save and reloads the current policy', async () => {
    const { source } = setup();
    await openPolicy('a');
    await source.write({ name: 'a', content: 'Theirs\n' });

    type('Mine\n');
    fireEvent.click(saveButton());
    await screen.findByText(/changed after you opened it/);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    await waitFor(() => expect(text()).toBe('Theirs\n'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(saveButton()).toHaveProperty('disabled', true);
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

  it('locks the list during a restore and drops it once another source opens', async () => {
    const { source, rerender } = await viewRevision();
    const restore = deferred();
    jest.mocked(source.restore).mockReturnValueOnce(restore.promise);

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    // The save button does not claim a restore as a save.
    for (const name of ['b', 'Restore', 'Save']) {
      expect(screen.getByRole('button', { name })).toHaveProperty(
        'disabled',
        true,
      );
    }

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
    ['read', { read: true, edit: false, admin: false }, false],
    ['edit', { read: true, edit: true, admin: false }, true],
    ['admin without edit', { read: true, edit: false, admin: true }, false],
  ])('renders only the controls %s allows', async (_, permissions, canEdit) => {
    await viewRevision({ permissions });

    for (const control of ['Save', 'Restore']) {
      expect(screen.queryByRole('button', { name: control }) !== null).toBe(
        canEdit,
      );
    }
    expect(screen.getByLabelText('Policy')).toHaveProperty(
      'readOnly',
      !canEdit,
    );
  });
});
