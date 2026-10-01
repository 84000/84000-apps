import { act, render } from '@testing-library/react';
import type { SearchResult } from '@eightyfourthousand/lib-search';

import { ReaderSearchButton } from './ReaderSearchButton';

const mockUpdatePanel = jest.fn();
const mockSearchButton = jest.fn<null, [unknown]>(() => null);

jest.mock('@eightyfourthousand/lib-search', () => ({
  SearchButton: (props: unknown) => mockSearchButton(props),
}));
jest.mock('./NavigationProvider', () => ({
  useNavigation: () => ({
    uuid: 'w1',
    toh: undefined,
    updatePanel: mockUpdatePanel,
  }),
}));
jest.mock('../editor/EditorProvider', () => ({
  useEditorState: () => ({
    applyReplacedPassages: jest.fn(),
    canEdit: async () => false,
    dirtyStore: { subscribe: () => () => undefined, getSnapshot: () => false },
  }),
}));
jest.mock('./SearchReplacePanel', () => ({ SearchReplacePanel: () => null }));

/** Renders the button and hands back the result handler it gives search. */
const renderOnResultSelected = async () => {
  await act(async () => {
    render(<ReaderSearchButton />);
  });
  const props = mockSearchButton.mock.lastCall?.[0] as {
    onResultSelected: (result: SearchResult) => void;
  };
  return props.onResultSelected;
};

beforeEach(() => {
  mockUpdatePanel.mockClear();
  mockSearchButton.mockClear();
});

describe('ReaderSearchButton passage results', () => {
  // `section` is the passage's raw type. A section's heading row is typed
  // `<section>Header`, and it lives in the same tab as the section body.
  it.each([
    ['abbreviationsHeader', 'right', 'abbreviations'],
    ['introductionHeader', 'main', 'front'],
    ['acknowledgment', 'main', 'front'],
    ['endnotes', 'right', 'endnotes'],
    ['translation', 'main', 'translation'],
  ])('opens a %s match in %s/%s', async (section, panel, tab) => {
    const onResultSelected = await renderOnResultSelected();

    onResultSelected({
      type: 'passage',
      uuid: 'p-1',
      content: '',
      section,
      label: '1',
    } as SearchResult);

    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: panel,
      state: { open: true, tab, hash: 'p-1' },
    });
  });
});
