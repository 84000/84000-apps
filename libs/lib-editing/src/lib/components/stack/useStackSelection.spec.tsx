import { renderHook } from '@testing-library/react';

import type { PassageStackController } from './PassageStackController';
import { useStackSelection } from './useStackSelection';

/** Two rows; the first has a Tibetan column, as in Compare. */
const rows = () => {
  document.body.innerHTML = `
    <div data-stack-passage="a">
      <p id="text">translation</p>
      <div data-compare-source=""><span id="tibetan">བོད་</span></div>
    </div>
    <div data-stack-passage="b"><p id="next">next</p></div>
  `;
  const next = document.getElementById('next') as HTMLElement;
  document.elementFromPoint = jest.fn(() => next);
};

const controller = () =>
  ({
    clearPassageSelection: jest.fn(),
    hasPassageSelection: jest.fn(() => false),
    setPassageSelection: jest.fn(),
  }) as unknown as PassageStackController & {
    setPassageSelection: jest.Mock;
  };

/** Press on an element and drag down onto the next row. */
const drag = (id: string) => {
  const target = document.getElementById(id) as HTMLElement;
  target.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    }),
  );
  target.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      buttons: 1,
      clientX: 10,
      clientY: 60,
    }),
  );
};

describe('useStackSelection', () => {
  it('selects the passages a drag crosses', () => {
    rows();
    const stack = controller();
    renderHook(() => useStackSelection(stack));

    drag('text');

    expect(stack.setPassageSelection).toHaveBeenCalledWith('a', 'b');
  });

  it('leaves a drag from the Tibetan column to the browser', () => {
    rows();
    const stack = controller();
    renderHook(() => useStackSelection(stack));

    drag('tibetan');

    expect(stack.setPassageSelection).not.toHaveBeenCalled();
  });
});
