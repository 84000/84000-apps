import { render, screen, waitFor } from '@testing-library/react';

import { StaticPassage } from './StaticPassage';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({})),
}));

jest.mock('./static-passage-html', () => ({
  ...jest.requireActual('./static-passage-html'),
  loadStaticPassages: jest.fn(),
}));

const { loadStaticPassages } = jest.requireMock('./static-passage-html') as {
  loadStaticPassages: jest.Mock;
};

const paragraph = (text: string) => [
  { type: 'paragraph', content: [{ type: 'text', text }] },
];

describe('StaticPassage', () => {
  beforeEach(() => loadStaticPassages.mockReset());

  it('draws given HTML without reading anything', () => {
    render(<StaticPassage uuid="p1" workUuid="w1" html="<p>given</p>" />);

    expect(screen.getByText('given')).toBeTruthy();
    expect(loadStaticPassages).not.toHaveBeenCalled();
  });

  it('renders given content as a static row does, with no editor', () => {
    const { container } = render(
      <StaticPassage uuid="p1" workUuid="w1" json={paragraph('held')} />,
    );

    expect(screen.getByText('held')).toBeTruthy();
    expect(container.querySelector('.tiptap.pm-text-metrics')).not.toBeNull();
    expect(container.querySelector('[contenteditable]')).toBeNull();
    expect(loadStaticPassages).not.toHaveBeenCalled();
  });

  it('reads the passage by uuid when given nothing else', async () => {
    loadStaticPassages.mockResolvedValue(new Map([['p1', '<p>read</p>']]));

    render(<StaticPassage uuid="p1" workUuid="w1" />);

    expect(await screen.findByText('read')).toBeTruthy();
    expect(loadStaticPassages).toHaveBeenCalledWith(
      expect.objectContaining({ workUuid: 'w1', uuids: ['p1'] }),
    );
  });

  it('draws nothing for a passage it cannot read', async () => {
    loadStaticPassages.mockResolvedValue(new Map());

    const { container } = render(<StaticPassage uuid="p1" workUuid="w1" />);

    await waitFor(() => expect(container.innerHTML).toBe(''));
  });
});
