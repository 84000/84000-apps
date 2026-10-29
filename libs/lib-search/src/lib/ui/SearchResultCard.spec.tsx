/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';

import type { AlignmentMatch } from '../types';
import { AlignmentResult } from './SearchResultCard';

const match: AlignmentMatch = {
  type: 'alignment',
  section: 'translation',
  uuid: 'p-1',
  label: '1.1',
  content: 'the sun rose',
  source: 'ཉི་མ།',
  volume: '1',
  folio: '12',
};

type Observed = (entries: { isIntersecting: boolean }[]) => void;
let observed: Observed | undefined;

beforeEach(() => {
  observed = undefined;
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver =
    class {
      constructor(callback: Observed) {
        observed = callback;
      }
      observe = jest.fn();
      disconnect = jest.fn();
    };
});

describe('AlignmentResult', () => {
  it('shows the plain text, highlighted, without a renderer', () => {
    render(<AlignmentResult match={match} query="sun" />);
    expect(screen.getByText('sun').tagName).toBe('MARK');
  });

  it('calls the renderer only once the result comes into view', () => {
    const renderEnglish = jest.fn(() => <div>rendered</div>);
    render(
      <AlignmentResult
        activeOccurrenceStart={4}
        match={match}
        query="sun"
        renderEnglish={renderEnglish}
      />,
    );

    expect(renderEnglish).not.toHaveBeenCalled();
    expect(screen.getByText('sun').tagName).toBe('MARK');

    act(() => observed?.([{ isIntersecting: true }]));

    expect(screen.getByText('rendered')).toBeTruthy();
    expect(renderEnglish).toHaveBeenCalledWith(
      expect.objectContaining({
        activeOccurrenceStart: 4,
        match,
        query: 'sun',
      }),
    );
  });
});
