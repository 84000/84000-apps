import { render } from '@testing-library/react';
import type { Editor } from '@tiptap/core';

import { PassageMenuOverlay } from './PassageMenuOverlay';
import type { PassageStorage } from './PassageNode';

const mockUpdatePanel = jest.fn();

jest.mock('../../../shared', () => ({
  ...jest.requireActual('../../../shared/types'),
  SuggestRevisionForm: () => null,
  useNavigation: () => ({
    toh: undefined,
    panels: { main: { open: true, tab: 'translation' } },
    updatePanel: mockUpdatePanel,
    imprint: undefined,
  }),
}));

jest.mock('@eightyfourthousand/data-access', () => ({
  getBookmarks: () => [],
  useBookmark: () => ({ isBookmarked: false, toggle: jest.fn() }),
}));

jest.mock('./EditorOptions', () => ({ EditorOptions: () => null }));
jest.mock('./ReaderOptions', () => ({ ReaderOptions: () => null }));
jest.mock('./EditLabel', () => ({ EditLabel: () => null }));
jest.mock('./ShowAnnotations', () => ({ ShowAnnotations: () => null }));
jest.mock('../EndNoteLink/endnote-utils', () => ({
  deleteEndnotePassageNode: jest.fn(),
}));
jest.mock('../../util', () => ({ findPassageNode: jest.fn() }));

/** Mounts the overlay over a bare editor and hands back its `navigateRef`. */
const renderNavigateRef = () => {
  const storage = {} as Partial<PassageStorage>;
  const editor = { storage: { passage: storage } } as unknown as Editor;
  render(<PassageMenuOverlay editor={editor} />);
  if (!storage.navigateRef) throw new Error('navigateRef was not registered');
  return storage.navigateRef;
};

beforeEach(() => mockUpdatePanel.mockClear());

describe('PassageMenuOverlay back-references', () => {
  // A section's heading row is typed `<section>Header`, and it lives in the
  // same tab as the section body, not in the translation fallback.
  it.each([
    ['abbreviationsHeader', 'right', 'abbreviations'],
    ['acknowledgmentHeader', 'main', 'front'],
    ['endnotes', 'right', 'endnotes'],
  ])('opens a %s reference in %s/%s', (type, panel, tab) => {
    const navigateRef = renderNavigateRef();

    navigateRef({ uuid: 'p-1', type });

    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: panel,
      state: { open: true, tab, hash: 'p-1' },
    });
  });
});
