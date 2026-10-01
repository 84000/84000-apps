import { renderHook } from '@testing-library/react';

import { useStackRowPointer } from './useStackRowPointer';
import type { PassageStackController } from './PassageStackController';

/** A stack container holding one back-reference of the given passage type. */
const containerWithReference = (refType: string) => {
  const container = document.createElement('div');
  const ref = document.createElement('a');
  ref.setAttribute('data-passage-reference', '');
  ref.setAttribute('data-ref-uuid', 'p-1');
  ref.setAttribute('data-ref-type', refType);
  container.appendChild(ref);
  document.body.appendChild(container);
  return { container, ref };
};

const renderPointer = (container: HTMLDivElement) => {
  const updatePanel = jest.fn();
  renderHook(() =>
    useStackRowPointer({
      parentRef: { current: container },
      controller: {
        isReadOnly: () => true,
        focusPassage: jest.fn(),
      } as unknown as PassageStackController,
      updatePanel,
      followLink: jest.fn(),
      setMenuTarget: jest.fn(),
    }),
  );
  return updatePanel;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useStackRowPointer back-references', () => {
  // A section's heading row is typed `<section>Header`, and it lives in the
  // same tab as the section body, not in the translation fallback.
  it.each([
    ['abbreviationsHeader', 'right', 'abbreviations'],
    ['introductionHeader', 'main', 'front'],
    ['endnotes', 'right', 'endnotes'],
  ])('opens a %s reference in %s/%s', (refType, panel, tab) => {
    const { container, ref } = containerWithReference(refType);
    const updatePanel = renderPointer(container as HTMLDivElement);

    ref.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(updatePanel).toHaveBeenCalledWith({
      name: panel,
      state: { open: true, tab, hash: 'p-1' },
    });
  });
});
