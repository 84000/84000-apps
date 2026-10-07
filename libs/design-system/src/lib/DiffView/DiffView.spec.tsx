import { render, screen } from '@testing-library/react';
import { DiffView, diffLines } from './DiffView';

const compact = (oldText: string, newText: string) =>
  diffLines(oldText, newText).map(
    ({ type, text }) =>
      `${{ removed: '-', added: '+', unchanged: ' ' }[type]}${text}`,
  );

describe('diffLines', () => {
  it('keeps common lines and orders removals before additions', () => {
    expect(compact('a\nb\nc\nd\n', 'a\nB\nc\nd\ne\n')).toEqual([
      ' a',
      '-b',
      '+B',
      ' c',
      ' d',
      '+e',
    ]);
  });

  it('finds common lines inside the changed middle', () => {
    expect(compact('x\na\ny\nb', 'a\nz\nb\nw')).toEqual([
      '-x',
      ' a',
      '-y',
      '+z',
      ' b',
      '+w',
    ]);
  });

  it('handles empty sides and ignores a trailing newline', () => {
    expect(compact('', 'a\n')).toEqual(['+a']);
    expect(compact('a\n', '')).toEqual(['-a']);
    expect(compact('a\n', 'a')).toEqual([' a']);
    expect(compact('', '')).toEqual([]);
  });
});

describe('DiffView', () => {
  it('marks lines with text, not only colour, and names each side', () => {
    const { container } = render(
      <DiffView
        oldText={'same\nold\n'}
        newText={'same\nnew\n'}
        oldLabel="Saved version"
        newLabel="Your changes"
      />,
    );

    expect(container.querySelector('del')?.textContent).toBe(
      '- Removed: old\n',
    );
    expect(container.querySelector('ins')?.textContent).toBe('+ Added: new\n');
    expect(screen.getByText('Saved version (1 removed)')).toBeTruthy();
    expect(screen.getByText('Your changes (1 added)')).toBeTruthy();
  });

  it('says when there are no differences', () => {
    render(<DiffView oldText="a" newText={'a\n'} />);
    expect(screen.getByText('There are no differences.')).toBeTruthy();
  });
});
