import { renderHook } from '@testing-library/react';
import type { TohokuCatalogEntry } from '@eightyfourthousand/data-access';

import { useStackTohVisibility } from './useStackTohVisibility';

const mockNavigation = {
  toh: undefined as TohokuCatalogEntry | undefined,
  setDefaultToh: jest.fn(),
};
const mockApplied: (TohokuCatalogEntry | undefined)[] = [];

jest.mock('../shared/NavigationContext', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('../shared/hooks/useTohToggle', () => ({
  useTohToggle: ({ toh }: { toh?: string }) => {
    mockApplied.push(toh as TohokuCatalogEntry | undefined);
  },
}));

beforeEach(() => {
  mockNavigation.toh = undefined;
  mockNavigation.setDefaultToh.mockClear();
  mockApplied.length = 0;
});

describe('useStackTohVisibility', () => {
  it('selects the work’s first Tohoku entry when nothing names one', () => {
    renderHook(() => useStackTohVisibility({ tohList: ['toh145', 'toh847'] }));

    // "A default toh should be selected on load" — otherwise no scope is
    // active and the rule below hides every scoped annotation.
    expect(mockNavigation.setDefaultToh).toHaveBeenCalledWith('toh145', [
      'toh145',
      'toh847',
    ]);
  });

  it('offers the first entry only as a default', () => {
    mockNavigation.toh = 'toh847';

    renderHook(() => useStackTohVisibility({ tohList: ['toh145', 'toh847'] }));

    // `NavigationProvider` resolves `?toh=` and `initialToh`; a default never
    // overwrites either.
    expect(mockNavigation.setDefaultToh).toHaveBeenCalledWith('toh145', [
      'toh145',
      'toh847',
    ]);
    expect(mockApplied).toContain('toh847');
  });

  it('applies the visibility rule for whichever toh is active', () => {
    mockNavigation.toh = 'toh417';

    renderHook(() => useStackTohVisibility({ tohList: ['toh145'] }));

    expect(mockApplied).toContain('toh417');
  });

  it('asks for no default when the work has no Tohoku entries', () => {
    renderHook(() => useStackTohVisibility({ tohList: [] }));

    expect(mockNavigation.setDefaultToh).not.toHaveBeenCalled();
  });
});
