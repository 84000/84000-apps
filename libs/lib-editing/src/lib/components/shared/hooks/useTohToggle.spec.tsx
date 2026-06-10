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

  it('does not throw on toh values that are not valid CSS identifiers', () => {
    expect(() =>
      renderHook(() => useTohToggle({ toh: 'toh4.1' as TohokuCatalogEntry })),
    ).not.toThrow();

    const sheet = getSheet();
    expect(sheet?.cssRules.length).toBe(1);
    expect(sheet?.cssRules[0].cssText).toContain('[data-toh="toh4.1"]');
  });
});
