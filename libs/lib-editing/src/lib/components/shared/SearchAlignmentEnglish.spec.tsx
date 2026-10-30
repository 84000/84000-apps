import { act, fireEvent, render, screen } from '@testing-library/react';
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

    expect(batcher.get).toHaveBeenCalledWith('p-1');
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

  it('keeps a link in the passage from navigating, but lets the click through', async () => {
    const onClick = jest.fn();
    await act(async () => {
      render(
        <div onClick={onClick}>
          <SearchAlignmentEnglish
            batcher={batcherWith(
              '<p><a href="/entity/folio/x">[F.1.a]</a> the sun</p>',
            )}
            fallback={null}
            match={match}
            query="sun"
          />
        </div>,
      );
    });

    const link = screen.getByText('[F.1.a]');
    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false);
    expect(onClick).toHaveBeenCalled();
  });

  it('reads the passage again for a new result set, keeping the old HTML up meanwhile', async () => {
    const batcher = batcherWith('<p>the sun rose</p>');
    const props = { batcher, fallback: <span>plain</span>, query: 'sun' };
    const { rerender } = render(
      <SearchAlignmentEnglish {...props} match={match} />,
    );
    await act(async () => undefined);

    rerender(<SearchAlignmentEnglish {...props} match={{ ...match }} />);
    expect(screen.queryByText('plain')).toBeNull();
    await act(async () => undefined);
    expect(batcher.get).toHaveBeenCalledTimes(2);
  });
});
