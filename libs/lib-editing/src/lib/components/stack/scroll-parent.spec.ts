import { scrollParent } from './PassageStack';

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

/** `<outer><middle><inner/></middle></outer>`, with styles applied inline. */
const nest = (styles: Partial<Record<'outer' | 'middle', string>>) => {
  document.body.innerHTML = '';
  const outer = document.createElement('div');
  const middle = document.createElement('div');
  const inner = document.createElement('div');
  if (styles.outer) outer.setAttribute('style', styles.outer);
  if (styles.middle) middle.setAttribute('style', styles.middle);
  outer.appendChild(middle);
  middle.appendChild(inner);
  document.body.appendChild(outer);
  return { outer, middle, inner };
};

/**
 * The stack does not own a scroller: its host has one, and creating a second
 * gave it a viewport as tall as its own content — every row visible, every
 * page fetched. See the note on `scrollParent`.
 */
describe('scrollParent', () => {
  it('finds the nearest scrollable ancestor', () => {
    const { outer, inner } = nest({ overflow: 'auto' } as never);
    outer.setAttribute('style', 'overflow-y: auto');
    expect(scrollParent(inner)).toBe(outer);
  });

  it('prefers the nearest one when several scroll', () => {
    const { outer, middle, inner } = nest({});
    outer.setAttribute('style', 'overflow-y: auto');
    middle.setAttribute('style', 'overflow-y: scroll');
    expect(scrollParent(inner)).toBe(middle);
  });

  it('skips ancestors that do not scroll', () => {
    const { outer, middle, inner } = nest({});
    outer.setAttribute('style', 'overflow-y: auto');
    middle.setAttribute('style', 'overflow-y: visible');
    expect(scrollParent(inner)).toBe(outer);
  });

  // web-main before the fix: every wrapper between the stack and the panel has
  // auto height and no overflow, so `height: 100%` resolved to auto.
  it('falls back to the document when nothing above scrolls', () => {
    const { inner } = nest({});
    expect(scrollParent(inner)).toBe(document.scrollingElement ?? document.body);
  });
});
