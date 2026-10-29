import { act, render, screen } from '@testing-library/react';
import type { AlignmentMatch } from '@eightyfourthousand/lib-search';

import { SearchAlignmentEnglish } from './SearchAlignmentEnglish';
import type { StaticPassageBatcher } from './static-passage-batcher';

jest.mock('@eightyfourthousand/lib-search', () => ({
  highlightHTML: ({ html, query }: { html: string; query: string }) =>
    html.replace(query, `<mark>${query}</mark>`),
}));

const match = {
  type: 'alignment',
  section: 'translation',
  uuid: 'p-1',
  label: '1.1',
  content: 'the sun rose',
  source: '',
  volume: '1',
  folio: '12',
} as AlignmentMatch;

const batcherWith = (html: string | null): StaticPassageBatcher => ({
  get: jest.fn(async () => html),
});

describe('SearchAlignmentEnglish', () => {
  it('draws the passage HTML with the matches marked', async () => {
    const batcher = batcherWith('<p>[F.12.b] the sun rose</p>');
    await act(async () => {
      render(
        <SearchAlignmentEnglish
          batcher={batcher}
          fallback={<span>plain</span>}
          match={match}
          query="sun"
        />,
      );
    });

    expect(batcher.get).toHaveBeenCalledWith('p-1', 'the sun rose');
    expect(screen.queryByText('plain')).toBeNull();
    expect(screen.getByText('sun').tagName).toBe('MARK');
    expect(screen.getByText(/\[F\.12\.b\]/)).toBeTruthy();
  });

  it('keeps the fallback when the passage cannot be read', async () => {
    await act(async () => {
      render(
        <SearchAlignmentEnglish
          batcher={batcherWith(null)}
          fallback={<span>plain</span>}
          match={match}
          query="sun"
        />,
      );
    });

    expect(screen.getByText('plain')).toBeTruthy();
  });
});
