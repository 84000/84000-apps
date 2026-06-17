import { renderHook } from '@testing-library/react';
import { TohokuCatalogEntry } from '@eightyfourthousand/data-access';
import { useTohToggle } from './useTohToggle';

const getSheet = () => {
  const styleEl = document.getElementById(
    'dynamic-visibility-rules',
  ) as HTMLStyleElement | null;
  return styleEl?.sheet ?? null;
};

describe('useTohToggle', () => {
  afterEach(() => {
    document.getElementById('dynamic-visibility-rules')?.remove();
  });

  it('inserts a single rule hiding non-active tohs', () => {
    renderHook(() => useTohToggle({ toh: 'toh257' }));

    const sheet = getSheet();
    expect(sheet?.cssRules.length).toBe(1);
    expect(sheet?.cssRules[0].cssText).toContain(
      '[data-toh]:not([data-toh="toh257"])',
    );
    expect(sheet?.cssRules[0].cssText).toContain('display: none');
  });

  it('hides all toh-scoped elements when no toh is active', () => {
    renderHook(() => useTohToggle({ toh: undefined }));

    const sheet = getSheet();
    expect(sheet?.cssRules.length).toBe(1);
    expect(sheet?.cssRules[0].cssText).toContain('[data-toh] {');
  });

  it('replaces rules when the active toh changes', () => {
    const { rerender } = renderHook(
      ({ toh }: { toh?: TohokuCatalogEntry }) => useTohToggle({ toh }),
      { initialProps: { toh: 'toh1' as TohokuCatalogEntry } },
    );
    rerender({ toh: 'toh2' as TohokuCatalogEntry });

    const sheet = getSheet();
    expect(sheet?.cssRules.length).toBe(1);
    expect(sheet?.cssRules[0].cssText).toContain('[data-toh="toh2"]');
  });

  it('matches the active toh as a member of a comma-separated list', () => {
    renderHook(() => useTohToggle({ toh: 'toh417' }));

    const cssText = getSheet()?.cssRules[0].cssText ?? '';
    // Keeps elements whose data-toh equals, starts with, contains, or ends
    // with the active toh as a comma-delimited token.
    expect(cssText).toContain(':not([data-toh="toh417"])');
    expect(cssText).toContain(':not([data-toh^="toh417,"])');
    expect(cssText).toContain(':not([data-toh*=",toh417,"])');
    expect(cssText).toContain(':not([data-toh$=",toh417"])');
  });

  it('hides only non-member tohs for multi-toh elements', () => {
    renderHook(() => useTohToggle({ toh: 'toh417' }));

    // Extract the selector (everything before the declaration block).
    const cssText = getSheet()?.cssRules[0].cssText ?? '';
    const selector = cssText.slice(0, cssText.indexOf('{')).trim();

    document.body.innerHTML = `
      <span id="multi" data-toh="toh417,toh418">visible</span>
      <span id="other" data-toh="toh418">hidden</span>
      <span id="prefix" data-toh="toh4170">hidden</span>
      <span id="plain">always visible</span>
    `;

    // The injected rule hides anything the selector matches.
    expect(document.getElementById('multi')?.matches(selector)).toBe(false);
    expect(document.getElementById('other')?.matches(selector)).toBe(true);
    expect(document.getElementById('prefix')?.matches(selector)).toBe(true);
    expect(document.getElementById('plain')?.matches(selector)).toBe(false);

    document.body.innerHTML = '';
  });

  it('does not throw on toh values that are not valid CSS identifiers', () => {
    expect(() =>
      renderHook(() => useTohToggle({ toh: 'toh4.1' as TohokuCatalogEntry })),
    ).not.toThrow();

    const sheet = getSheet();
    expect(sheet?.cssRules.length).toBe(1);
    expect(sheet?.cssRules[0].cssText).toContain('[data-toh="toh4.1"]');
  });
});
