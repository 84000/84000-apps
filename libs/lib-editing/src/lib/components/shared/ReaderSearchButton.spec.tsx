import type { ReactElement } from 'react';
import { act, render } from '@testing-library/react';
import type { SearchResult } from '@eightyfourthousand/lib-search';

import { ReaderSearchButton } from './ReaderSearchButton';

const mockUpdatePanel = jest.fn();
const mockSearchButton = jest.fn<null, [unknown]>(() => null);
let mockReadOnly = true;

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
    readOnly: mockReadOnly,
    dirtyStore: { subscribe: () => () => undefined, getSnapshot: () => false },
  }),
}));
const mockSearchReplacePanel = jest.fn<null, [unknown]>(() => null);
jest.mock('./SearchReplacePanel', () => ({
  SearchReplacePanel: (props: unknown) => mockSearchReplacePanel(props),
}));

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
  mockSearchReplacePanel.mockClear();
  mockReadOnly = true;
});

describe('ReaderSearchButton replace', () => {
  const canReplace = async () => {
    await act(async () => {
      render(<ReaderSearchButton />);
    });
    const { renderActions } = mockSearchButton.mock.lastCall?.[0] as {
      renderActions: (searchContext: unknown) => ReactElement;
    };
    render(renderActions({}));
    return (
      mockSearchReplacePanel.mock.lastCall?.[0] as { canReplace: boolean }
    ).canReplace;
  };

  it('offers replace in an editable editor', async () => {
    mockReadOnly = false;

    expect(await canReplace()).toBe(true);
  });

  it('withholds replace while the editor is read-only', async () => {
    // Read-only both without edit permission and when an editor chose it.
    mockReadOnly = true;

    expect(await canReplace()).toBe(false);
  });
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

describe('ReaderSearchButton alignment results', () => {
  // A Translation Passages result names its passage, and Compare scrolls to
  // it through the panel hash.
  it('opens Compare at the matched passage', async () => {
    const onResultSelected = await renderOnResultSelected();

    onResultSelected({
      type: 'alignment',
      uuid: 'p-10',
      content: '',
      section: 'translation',
      label: '1.10',
      source: '',
      volume: '1',
      folio: '1',
    } as SearchResult);

    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: 'main',
      state: { open: true, tab: 'compare', hash: 'p-10' },
    });
  });
});
