import { render } from '@testing-library/react';
import { useCommentAnchorStyles } from './useCommentAnchorStyles';

const Harness = (props: { highlighted?: string; suppressed?: string[] }) => {
  useCommentAnchorStyles(props);
  return null;
};

const rules = () => {
  const el = document.getElementById(
    'comment-anchor-styles',
  ) as HTMLStyleElement | null;
  return [...(el?.sheet?.cssRules ?? [])].map((rule) => rule.cssText);
};

describe('useCommentAnchorStyles', () => {
  it('highlights every anchor of the thread, not one mark', () => {
    // The selector is the contract: a thread may be anchored several times, and
    // static rows carry no mark view to ask.
    render(<Harness highlighted="t1" />);

    expect(rules()).toHaveLength(1);
    expect(rules()[0]).toContain('[type="comment"][comment="t1"]');
  });

  it('replaces the rules rather than accumulating them', () => {
    const { rerender } = render(<Harness highlighted="t1" />);
    rerender(<Harness highlighted="t2" />);

    expect(rules()).toHaveLength(1);
    expect(rules()[0]).toContain('"t2"');
  });

  it('clears the highlight when nothing is selected', () => {
    const { rerender } = render(<Harness highlighted="t1" />);
    rerender(<Harness />);

    expect(rules()).toEqual([]);
  });

  it('leaves nothing behind on unmount', () => {
    const { unmount } = render(<Harness highlighted="t1" />);
    unmount();

    expect(rules()).toEqual([]);
  });

  it('escapes the uuid so a quote cannot end the selector', () => {
    render(<Harness highlighted={'t"1'} />);

    expect(rules()[0]).toContain('t\\"1');
  });

  it('takes the marking off suppressed threads in one rule', () => {
    render(<Harness suppressed={['t1', 't2']} />);

    expect(rules()).toHaveLength(1);
    expect(rules()[0]).toContain('[comment="t1"]');
    expect(rules()[0]).toContain('[comment="t2"]');
    expect(rules()[0]).toContain('transparent');
  });

  it('never hides the element, only its marking', () => {
    // The mark wraps real document text, so `display: none` would take the
    // words with it.
    render(<Harness suppressed={['t1']} />);

    expect(rules()[0]).not.toContain('display');
  });

  it('paints a suppressed thread that is also highlighted', () => {
    // Order decides it: a resolved thread the panel has brought into view is
    // painted, so the highlight rule comes after the suppression.
    render(<Harness highlighted="t1" suppressed={['t1']} />);

    const [suppress, highlight] = rules();
    expect(suppress).toContain('transparent');
    expect(highlight).toContain('var(--color-secondary)');
  });

  it('writes no suppression rule when nothing is suppressed', () => {
    render(<Harness highlighted="t1" suppressed={[]} />);

    expect(rules()).toHaveLength(1);
    expect(rules()[0]).toContain('var(--color-secondary)');
  });
});
