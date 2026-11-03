import { act, render, screen } from '@testing-library/react';

import { EndNoteLinkHoverContent } from './EndNoteLinkHoverContent';

const mockFetchEndNote = jest.fn();
let mockLabels: unknown = null;

jest.mock('../../../shared/NavigationContext', () => ({
  useNavigation: () => ({ fetchEndNote: mockFetchEndNote }),
}));
jest.mock('../../EditorProvider', () => ({
  useEditorState: () => ({
    deleteEndnote: jest.fn(),
    endnoteLabels: mockLabels,
  }),
}));
jest.mock('../useHoverCardEditor', () => ({
  useHoverCardEditor: () => jest.fn(),
}));

/** The stack's labels, as the editor offers them; `relabel` changes one. */
const stackWith = (labels: Record<string, string>) => {
  const listeners = new Set<() => void>();
  mockLabels = {
    label: (uuid: string) => labels[uuid],
    observe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return (uuid: string, label: string) => {
    labels[uuid] = label;
    listeners.forEach((listener) => listener());
  };
};

const renderCard = () =>
  render(
    <EndNoteLinkHoverContent
      uuid="link-1"
      endNote="note-1"
      requestEditor={jest.fn()}
      anchor={document.createElement('span')}
      close={jest.fn()}
      setHoverCardEditing={jest.fn()}
      editable={false}
    />,
  );

beforeEach(() => {
  mockLabels = null;
  mockFetchEndNote.mockReset();
});

describe('EndNoteLinkHoverContent label', () => {
  it('shows an unsaved stack endnote without a fetch', () => {
    stackWith({ 'note-1': '1.3' });

    renderCard();

    expect(screen.getByText('1.3')).toBeTruthy();
    expect(mockFetchEndNote).not.toHaveBeenCalled();
  });

  it('shows the renumbered label over a saved one', async () => {
    mockFetchEndNote.mockResolvedValue({ label: '1.2' });
    const relabel = stackWith({ 'note-1': '1.2' });

    renderCard();
    act(() => relabel('note-1', '1.3'));

    expect(screen.getByText('1.3')).toBeTruthy();
    expect(screen.queryByText('1.2')).toBeNull();
    expect(mockFetchEndNote).not.toHaveBeenCalled();
  });

  it('fetches the label with no stack', async () => {
    mockFetchEndNote.mockResolvedValue({ label: '1.2' });

    renderCard();

    expect(await screen.findByText('1.2')).toBeTruthy();
    expect(mockFetchEndNote).toHaveBeenCalledWith('note-1');
  });

  it('fetches a note the stack does not hold', async () => {
    stackWith({});
    mockFetchEndNote.mockResolvedValue({ label: '2.1' });

    renderCard();

    expect(await screen.findByText('2.1')).toBeTruthy();
  });
});
