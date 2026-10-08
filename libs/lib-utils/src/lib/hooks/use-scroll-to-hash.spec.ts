import { waitForAncestorAnimations } from './use-scroll-to-hash';

/** An animation stub that finishes when `finish` is called. */
const animation = (endTime: number) => {
  let finish = () => undefined as void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return {
    finish,
    stub: {
      effect: { getComputedTiming: () => ({ endTime }) },
      finished,
    } as unknown as Animation,
  };
};

const nest = () => {
  const outer = document.createElement('div');
  const inner = document.createElement('div');
  outer.appendChild(inner);
  return { outer, inner };
};

describe('waitForAncestorAnimations', () => {
  it('resolves at once when nothing above is animating', async () => {
    const { inner } = nest();
    await expect(waitForAncestorAnimations(inner)).resolves.toBeUndefined();
  });

  it('waits for a finite animation on an ancestor', async () => {
    const { outer, inner } = nest();
    const slide = animation(300);
    outer.getAnimations = () => [slide.stub];

    let done = false;
    const waiting = waitForAncestorAnimations(inner).then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);

    slide.finish();
    await waiting;
    expect(done).toBe(true);
  });

  // An infinite animation, such as a pulsing skeleton, never finishes.
  it('does not wait on an infinite animation', async () => {
    const { outer, inner } = nest();
    outer.getAnimations = () => [animation(Infinity).stub];

    await expect(waitForAncestorAnimations(inner)).resolves.toBeUndefined();
  });
});
