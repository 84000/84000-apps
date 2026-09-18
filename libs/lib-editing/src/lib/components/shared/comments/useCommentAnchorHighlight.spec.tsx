import { render } from '@testing-library/react';
import { useCommentAnchorHighlight } from './useCommentAnchorHighlight';

const Harness = ({ uuid }: { uuid?: string }) => {
  useCommentAnchorHighlight(uuid);
  return null;
};

const rules = () => {
  const el = document.getElementById(
    'comment-anchor-highlight',
  ) as HTMLStyleElement | null;
  return [...(el?.sheet?.cssRules ?? [])].map((rule) => rule.cssText);
};

describe('useCommentAnchorHighlight', () => {
  it('highlights every anchor of the thread, not one mark', () => {
    // The selector is the contract: a thread may be anchored several times, and
    // static rows carry no mark view to ask.
    render(<Harness uuid="t1" />);

    expect(rules()).toHaveLength(1);
    expect(rules()[0]).toContain('[type="comment"][comment="t1"]');
  });

  it('replaces the rule rather than accumulating them', () => {
    const { rerender } = render(<Harness uuid="t1" />);
    rerender(<Harness uuid="t2" />);

    expect(rules()).toHaveLength(1);
    expect(rules()[0]).toContain('"t2"');
  });

  it('clears the highlight when nothing is selected', () => {
    const { rerender } = render(<Harness uuid="t1" />);
    rerender(<Harness />);

    expect(rules()).toEqual([]);
  });

  it('leaves no highlight behind on unmount', () => {
    const { unmount } = render(<Harness uuid="t1" />);
    unmount();

    expect(rules()).toEqual([]);
  });

  it('escapes the uuid so a quote cannot end the selector', () => {
    render(<Harness uuid={'t"1'} />);

    expect(rules()[0]).toContain('t\\"1');
  });
});
