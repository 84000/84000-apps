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

describe('useStackRowPointer click-to-focus', () => {
  /** A static row holding text and a button in its footer. */
  const rowWithButton = () => {
    const container = document.createElement('div');
    container.innerHTML =
      '<div data-stack-passage="r-1"><p>Text</p><div contenteditable="false"><button>Passages ›</button></div></div>';
    document.body.appendChild(container);
    const focusPassage = jest.fn();
    renderHook(() =>
      useStackRowPointer({
        parentRef: { current: container },
        controller: {
          isReadOnly: () => false,
          focusPassage,
        } as unknown as PassageStackController,
        updatePanel: jest.fn(),
        followLink: jest.fn(),
        setMenuTarget: jest.fn(),
      }),
    );
    return { container, focusPassage };
  };

  const press = (target: Element) => {
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  };

  it('focuses a static row pressed on its text', () => {
    const { container, focusPassage } = rowWithButton();
    press(container.querySelector('p') as Element);
    expect(focusPassage).toHaveBeenCalledWith('r-1', expect.anything());
  });

  it('leaves a press on a control in the row to the control', () => {
    const { container, focusPassage } = rowWithButton();
    press(container.querySelector('button') as Element);
    expect(focusPassage).not.toHaveBeenCalled();
  });
});
