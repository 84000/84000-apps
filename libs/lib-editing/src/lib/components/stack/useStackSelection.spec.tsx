import { renderHook } from '@testing-library/react';
import { toast } from '@eightyfourthousand/design-system';

import type { PassageStackController } from './PassageStackController';
import { useStackSelection } from './useStackSelection';

jest.mock('@eightyfourthousand/design-system', () => ({ toast: jest.fn() }));

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

describe('the undo offered after deleting passages', () => {
  /** Delete two selected passages; returns the toast's Undo and the stack. */
  const deleteTwo = () => {
    const log = { last: { kind: 'delete' } as unknown };
    const stack = {
      clearPassageSelection: jest.fn(),
      hasPassageSelection: jest.fn(() => true),
      selectedUuids: jest.fn(() => ['a', 'b']),
      deletePassageSelection: jest.fn(() => true),
      undo: jest.fn(),
      work: { log: { peekUndo: () => log.last } },
    } as unknown as PassageStackController & { undo: jest.Mock };
    renderHook(() => useStackSelection(stack));
    (toast as unknown as jest.Mock).mockClear();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    const undo = (toast as unknown as jest.Mock).mock.calls[0][1].action
      .onClick;
    return { stack, log, undo: undo as () => void };
  };

  it('undoes the delete', () => {
    const { stack, undo } = deleteTwo();
    undo();
    expect(stack.undo).toHaveBeenCalled();
  });

  it('does nothing once something else was done since', () => {
    const { stack, log, undo } = deleteTwo();
    log.last = { kind: 'text' };
    undo();
    expect(stack.undo).not.toHaveBeenCalled();
  });
});
