import { render } from '@testing-library/react';

import { PassageSkeleton } from './PassageSkeleton';

const skeleton = (el: HTMLElement) =>
  el.querySelector<HTMLElement>('[data-passage-skeleton]');

describe('PassageSkeleton', () => {
  it('occupies exactly the height the row was sized for', () => {
    const { container } = render(<PassageSkeleton height={252} sized />);

    // The virtualizer measures this, so it has to be the height it was given:
    // a short placeholder becomes the row's height rather than being corrected.
    expect(skeleton(container)?.style.height).toBe('252px');
  });

  it('pays for the gap between passages out of its own box', () => {
    const { container } = render(<PassageSkeleton height={252} sized />);
    const el = skeleton(container);

    // The gap is a transparent border, not a margin: a margin would collapse
    // out of a row that has no padding, and this element is what the
    // virtualizer measures — so it has to stay exactly the height it was given.
    expect(el?.style.boxSizing).toBe('border-box');
    expect(el?.style.borderBottom).toContain('transparent');
    expect(el?.style.height).toBe('252px');
    // Otherwise the background would paint across the gap and close it again.
    expect(el?.style.backgroundClip).toBe('padding-box');
  });

  it('is one block, not a stack of lines', () => {
    const { container } = render(<PassageSkeleton height={252} sized />);

    expect(skeleton(container)?.children).toHaveLength(0);
  });

  it('marks itself sized when the height came from the passage', () => {
    const { container } = render(<PassageSkeleton height={252} sized />);

    expect(skeleton(container)?.dataset['passageSkeleton']).toBe('sized');
  });

  it('marks itself generic when the height is only a fallback', () => {
    const { container } = render(
      <PassageSkeleton height={112} sized={false} />,
    );

    // So a row that comes out mis-sized can be traced back to whether any
    // size was available for it.
    expect(skeleton(container)?.dataset['passageSkeleton']).toBe('generic');
  });

  it('is hidden from assistive tech — it stands for content, it is not content', () => {
    const { container } = render(<PassageSkeleton height={112} sized />);

    expect(skeleton(container)?.getAttribute('aria-hidden')).toBe('true');
  });

  it('carries the marker the WebKit animation guard keys off', () => {
    const { container } = render(<PassageSkeleton height={112} sized />);

    // A running animation during a large DOM replacement can wedge WebKit's
    // main thread, and a virtualized list replaces subtrees continuously.
    expect(skeleton(container)?.hasAttribute('data-skeleton')).toBe(true);
  });

  it('draws in a colour that is not the page background', () => {
    const { container } = render(<PassageSkeleton height={112} sized />);

    // `bg-muted` resolves to the studio's own page background, which draws a
    // placeholder nobody can see.
    expect(skeleton(container)?.className).toContain('bg-foreground/10');
    expect(skeleton(container)?.className).not.toContain('bg-muted');
  });
});
