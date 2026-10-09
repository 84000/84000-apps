/**
 * @jest-environment jsdom
 */
import type {
  PolicyEditorProps,
  PolicySource,
} from '@eightyfourthousand/lib-editing/policy-editor';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PolicyEditorApp, permissionLabel } from './PolicyEditorApp';

let editorProps: PolicyEditorProps;

// The editor itself is covered in lib-editing; this stands in for it so a
// spec can fire its callbacks.
jest.mock('@eightyfourthousand/lib-editing/policy-editor', () => ({
  PolicyEditor: (props: PolicyEditorProps) => {
    editorProps = props;
    return <div data-testid="editor" />;
  },
}));

const source = {} as PolicySource;
const permissions = { read: true, edit: true, admin: false };

const setup = (sendMessage = jest.fn().mockResolvedValue({})) => {
  const app = {
    updateModelContext: jest.fn().mockResolvedValue({}),
    sendMessage,
  };
  render(
    <PolicyEditorApp
      app={app}
      source={source}
      permissions={permissions}
      initialName="a/b"
    />,
  );
  return app;
};

const lastText = (mock: jest.Mock) =>
  mock.mock.calls.at(-1)?.[0].content.map((c: { text: string }) => c.text);

describe('PolicyEditorApp', () => {
  it('passes the source, permissions and initial name to the editor', () => {
    setup();
    expect(editorProps).toMatchObject({
      source,
      permissions,
      initialName: 'a/b',
    });
    expect(screen.getByText('Can edit')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tell Claude' })).toBeNull();
  });

  it('reports each change to the model context, keeping earlier ones', async () => {
    const app = setup();
    await act(async () => {
      editorProps.onSaved?.({
        ok: true,
        name: 'a/b',
        version: 'v2',
        created: false,
      });
    });
    await act(async () => {
      editorProps.onRenamed?.({
        from: 'a/b',
        to: 'a/c',
        archivedPath: 'archive/a/b.md/1.md',
      });
    });

    expect(app.updateModelContext).toHaveBeenCalledTimes(2);
    expect(lastText(app.updateModelContext)).toEqual([
      expect.stringContaining('"a/b" was saved (new version v2)'),
      expect.stringContaining('"a/b" was renamed to "a/c"'),
    ]);
    expect(app.sendMessage).not.toHaveBeenCalled();
  });

  it('tells Claude about the last change only when the user clicks', async () => {
    const app = setup();
    await act(async () => {
      editorProps.onDeleted?.({
        name: 'a/b',
        archivedPath: 'archive/a/b.md/2.md',
      });
    });
    expect(app.sendMessage).not.toHaveBeenCalled();

    const button = screen.getByRole('button', { name: 'Tell Claude' });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(app.sendMessage).toHaveBeenCalledTimes(1);
    expect(lastText(app.sendMessage)).toEqual([
      expect.stringContaining('"a/b" was deleted'),
    ]);
    expect(screen.getByText('Claude was told.')).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('says so when the host refuses the message, and allows a retry', async () => {
    setup(jest.fn().mockResolvedValue({ isError: true }));
    await act(async () => {
      editorProps.onSaved?.({
        ok: true,
        name: 'a/b',
        version: 'v2',
        created: false,
      });
    });
    const button = screen.getByRole('button', { name: 'Tell Claude' });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByText('Could not tell Claude.')).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps Tell Claude open for a change made while a message was sending', async () => {
    let finish: (result: object) => void = () => undefined;
    setup(
      jest.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    );
    await act(async () => {
      editorProps.onSaved?.({
        ok: true,
        name: 'a/b',
        version: 'v2',
        created: false,
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tell Claude' }));
    });
    await act(async () => {
      editorProps.onSaved?.({
        ok: true,
        name: 'a/b',
        version: 'v3',
        created: false,
      });
    });
    await act(async () => {
      finish({});
    });

    expect(screen.queryByText('Claude was told.')).toBeNull();
    const button = screen.getByRole('button', { name: 'Tell Claude' });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute('title')).toContain('version v3');
  });
});

describe('permissionLabel', () => {
  it.each([
    [{ read: false, edit: false, admin: false }, 'No access'],
    [{ read: true, edit: false, admin: false }, 'Read-only'],
    [{ read: true, edit: true, admin: false }, 'Can edit'],
    [{ read: true, edit: true, admin: true }, 'Admin'],
  ])('%j is %s', (permissions, label) => {
    expect(permissionLabel(permissions)).toBe(label);
  });
});
