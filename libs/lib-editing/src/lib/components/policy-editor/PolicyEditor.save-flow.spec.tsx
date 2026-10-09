import { act, fireEvent, render, screen } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { createMemoryPolicySource } from './memory-policy-source';
import { PolicyEditor } from './PolicyEditor';
import type { PolicySource, PolicyWriteResult } from './policy-source';

// Unlike PolicyEditor.spec.tsx, this file leaves MarkdownEditor real, so a
// save is echoed back through the editor's own echo handling.

// jsdom has neither; policyVersion needs both.
Object.assign(globalThis, { TextEncoder });
Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle });

// jsdom has no ResizeObserver; the resizable policy list needs one.
globalThis.ResizeObserver ??= class {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
};

// An HTML block does not round-trip, so the policy opens as raw markdown.
const A1 = '<div>x</div>\n';
const A2 = `${A1}second\n`;
const A3 = `${A2}third\n`;

/** A source whose writes wait for the test to release them. */
const deferWrites = (inner: PolicySource) => {
  const releases: (() => void)[] = [];
  const source: PolicySource = {
    ...inner,
    write: (input) =>
      new Promise<PolicyWriteResult>((resolve, reject) => {
        releases.push(() => inner.write(input).then(resolve, reject));
      }),
  };
  return {
    source,
    release: () => act(async () => releases.shift()?.()),
  };
};

const raw = () =>
  screen.getByRole('textbox', {
    name: 'Markdown source',
  }) as HTMLTextAreaElement;

const type = (value: string) => fireEvent.change(raw(), { target: { value } });

const saveButton = () => screen.getByRole('button', { name: 'Save' });

describe('PolicyEditor save flow with the real MarkdownEditor', () => {
  it('keeps typing made during a save, and measures it against what was saved', async () => {
    const { source, release } = deferWrites(
      createMemoryPolicySource({ a: A1 }),
    );
    const onDirtyChange = jest.fn();
    const { container } = render(
      <PolicyEditor
        source={source}
        permissions={{ read: true, edit: true, admin: false }}
        onDirtyChange={onDirtyChange}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'a' }));
    await screen.findByRole('heading', { name: 'a' });
    await screen.findByRole('textbox', { name: 'Markdown source' });
    expect(
      container.querySelector('[data-markdown-mode="raw"]'),
    ).not.toBeNull();

    type(A2);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(saveButton());
    await act(async () => undefined);

    // Typed while the write is in flight.
    type(A3);
    await release();

    expect(raw().value).toBe(A3);
    expect(saveButton().hasAttribute('disabled')).toBe(false);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    // A2 is what was saved, so typing back to it is clean.
    type(A2);
    expect(raw().value).toBe(A2);
    expect(saveButton().hasAttribute('disabled')).toBe(true);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});
