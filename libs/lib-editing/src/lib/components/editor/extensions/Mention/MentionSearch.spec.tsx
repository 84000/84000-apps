import { fireEvent, render, screen } from '@testing-library/react';

import { MentionSearch } from './MentionSearch';
import type { MentionSearchResult } from './useMentionSearch';

const mockResults: MentionSearchResult[] = [];

jest.mock('./useMentionSearch', () => ({
  ...jest.requireActual('./useMentionSearch'),
  useMentionSearch: () => ({ results: mockResults, loading: false }),
}));
jest.mock('../../../shared', () => ({
  useNavigation: () => ({ uuid: 'w-1', toh: 'toh871' }),
}));

describe('MentionSearch', () => {
  beforeEach(() => mockResults.splice(0));

  it("reports a passage's section and Toh with the selection", () => {
    mockResults.push({
      entity: 'n-4',
      linkType: 'passage',
      label: 'n.4',
      text: 'A note',
      subtype: 'endnotes',
      linkToh: 'toh871',
    });
    const onSelect = jest.fn();
    render(<MentionSearch initialQuery="note" onSelect={onSelect} />);

    fireEvent.click(screen.getByText('n.4'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'n-4',
        isSameWork: true,
        location: { subtype: 'endnotes', linkToh: 'toh871' },
      }),
    );
  });
});
