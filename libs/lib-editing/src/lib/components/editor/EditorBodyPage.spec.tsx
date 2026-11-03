import { render, waitFor } from '@testing-library/react';

import { EditorBodyPage } from './EditorBodyPage';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({})),
  BODY_MATTER_FILTER: 'body',
  FRONT_MATTER_FILTER: 'front',
  getTranslationBlocks: jest.fn(async () => ({
    blocks: [],
    hasMoreAfter: false,
  })),
  getTranslationTitles: jest.fn(async () => []),
}));
jest.mock('next/dynamic', () => () => () => null);
jest.mock('../shared/BodyPanel', () => ({
  BodyPanel: () => <div data-testid="body-panel" />,
}));
jest.mock('./TitlesBuilder', () => ({ TitlesBuilder: () => null }));
jest.mock('./EditorProvider', () => ({
  useEditorState: () => ({ work: { uuid: 'w1' } }),
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  getTranslationBlocks: jest.Mock;
};

/** Front matter reads that never settle; the rest resolve empty. */
const frontNeverSettles = () =>
  clientGraphql.getTranslationBlocks.mockImplementation(
    async ({ type }: { type: string }) =>
      type === 'front'
        ? new Promise(() => undefined)
        : { blocks: [], hasMoreAfter: false },
  );

beforeEach(() => {
  clientGraphql.getTranslationBlocks.mockReset();
  clientGraphql.getTranslationBlocks.mockResolvedValue({
    blocks: [],
    hasMoreAfter: false,
  });
});

describe('EditorBodyPage', () => {
  // The stack reads front matter itself.
  it('renders without waiting on a front matter read', async () => {
    frontNeverSettles();

    const view = render(<EditorBodyPage />);

    await waitFor(() =>
      expect(view.queryByTestId('body-panel')).not.toBeNull(),
    );
  });

  it('does not read the front matter', async () => {
    const view = render(<EditorBodyPage />);

    await waitFor(() =>
      expect(view.queryByTestId('body-panel')).not.toBeNull(),
    );
    expect(clientGraphql.getTranslationBlocks).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'front' }),
    );
  });
});
