import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { TohVisibilityStyle, tohHiddenSelector } from './useTohToggle';

// Acceptance tests for DEV-837 item 6a, section 2: `TohVisibilityStyle` and
// `tohHiddenSelector` (AC6.4 to AC6.6). AC6.7 is in
// `reader/ReaderLayout.toh-visibility.acceptance.spec.tsx`.

/** The text of every `<style>` element in a piece of server-rendered HTML. */
const styleTextIn = (html: string) =>
  [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(
    (match) => match[1],
  );

/** The `data-toh` values from AC6.5, and whether each is shown for toh847. */
const CASES: [string, boolean][] = [
  ['toh145', false],
  ['toh847', true],
  ['toh145,toh847', true],
  ['toh847,toh145', true],
  ['toh84', false],
  ['toh8470', false],
];

describe('TohVisibilityStyle on the server', () => {
  it('AC6.4: renders a <style> rule hiding what tohHiddenSelector selects, with no effect or script', () => {
    const html = renderToString(<TohVisibilityStyle toh="toh847" />);

    const styles = styleTextIn(html);
    expect(styles).toHaveLength(1);
    expect(styles[0]).toContain(tohHiddenSelector('toh847'));
    expect(styles[0]).toMatch(/display:\s*none/);
    expect(html).not.toContain('<script');
  });

  it('AC6.4: the rule is the selector followed by a display: none block', () => {
    const html = renderToString(<TohVisibilityStyle toh="toh847" />);

    const [rule] = styleTextIn(html);
    const selector = tohHiddenSelector('toh847');
    expect(rule.trim().startsWith(selector)).toBe(true);
    expect(rule.slice(rule.indexOf(selector) + selector.length)).toMatch(
      /^\s*\{\s*display:\s*none;?\s*\}/,
    );
  });

  it('AC6.4: names the Toh it was given in the selector', () => {
    expect(tohHiddenSelector('toh847')).toContain('toh847');
    expect(tohHiddenSelector('toh145')).toContain('toh145');
    expect(tohHiddenSelector('toh145')).not.toContain('toh847');
    expect(renderToString(<TohVisibilityStyle toh="toh145" />)).toContain(
      tohHiddenSelector('toh145'),
    );
  });

  it('AC6.6: renders nothing with no toh', () => {
    expect(renderToString(<TohVisibilityStyle />)).toBe('');
  });
});

describe('TohVisibilityStyle in the browser', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style').forEach((style) => style.remove());
  });

  const renderWithElements = () =>
    render(
      <>
        <TohVisibilityStyle toh="toh847" />
        {CASES.map(([value]) => (
          <span key={value} data-testid={value} data-toh={value}>
            {value}
          </span>
        ))}
        <span data-testid="plain">not scoped to any toh</span>
      </>,
    );

  it.each(CASES)(
    'AC6.5: data-toh="%s" matches the hidden selector: %s',
    (value, shown) => {
      const { getByTestId } = renderWithElements();

      expect(getByTestId(value).matches(tohHiddenSelector('toh847'))).toBe(
        !shown,
      );
    },
  );

  it('AC6.5: leaves an element with no data-toh out of the hidden selector', () => {
    const { getByTestId } = renderWithElements();

    expect(getByTestId('plain').matches(tohHiddenSelector('toh847'))).toBe(
      false,
    );
  });

  it.each(CASES)(
    'AC6.5: data-toh="%s" is hidden by the rendered rule only when it is not shown',
    (value, shown) => {
      const { getByTestId } = renderWithElements();

      const display = getComputedStyle(getByTestId(value)).display;
      if (shown) {
        expect(display).not.toBe('none');
      } else {
        expect(display).toBe('none');
      }
    },
  );

  it('AC6.5: shows an element with no data-toh', () => {
    const { getByTestId } = renderWithElements();

    expect(getComputedStyle(getByTestId('plain')).display).not.toBe('none');
  });

  it('AC6.6: renders nothing with no toh', () => {
    const { container } = render(<TohVisibilityStyle />);

    expect(container.innerHTML).toBe('');
    expect(document.querySelectorAll('style')).toHaveLength(0);
  });
});
