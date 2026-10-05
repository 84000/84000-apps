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
jest.mock('.', () => ({ TranslationBuilder: () => null }));
jest.mock('../shared/BodyPanel', () => ({
  BodyPanel: () => <div data-testid="body-panel" />,
}));
jest.mock('./TitlesBuilder', () => ({ TitlesBuilder: () => null }));
jest.mock('./EditorProvider', () => ({
  useEditorState: () => ({ work: { uuid: 'w1' } }),
}));
const mockFlag = { enabled: false, ready: false };
jest.mock('./usePerPassageDocs', () => ({
  usePerPassageDocs: () => mockFlag,
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
  describe('before the flag settles', () => {
    beforeEach(() => Object.assign(mockFlag, { enabled: false, ready: false }));

    // The paginated editor must not wait on the flag to start reading.
    it('reads the front matter at mount', async () => {
      render(<EditorBodyPage />);

      await waitFor(() =>
        expect(clientGraphql.getTranslationBlocks).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'front' }),
        ),
      );
    });
  });

  describe('with the stack on', () => {
    beforeEach(() => Object.assign(mockFlag, { enabled: true, ready: true }));

    // The stack reads front matter itself: the paginated read goes unused.
    it('renders without waiting on a front matter read', async () => {
      frontNeverSettles();

      const view = render(<EditorBodyPage />);

      await waitFor(() =>
        expect(view.queryByTestId('body-panel')).not.toBeNull(),
      );
    });

    it('does not read the front matter it would not use', async () => {
      const view = render(<EditorBodyPage />);

      await waitFor(() =>
        expect(view.queryByTestId('body-panel')).not.toBeNull(),
      );
      expect(clientGraphql.getTranslationBlocks).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'front' }),
      );
    });
  });

  describe('with the stack off', () => {
    beforeEach(() => Object.assign(mockFlag, { enabled: false, ready: true }));

    it('waits for the front matter it draws', async () => {
      frontNeverSettles();

      const view = render(<EditorBodyPage />);

      await waitFor(() =>
        expect(clientGraphql.getTranslationBlocks).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'front' }),
        ),
      );
      expect(view.queryByTestId('body-panel')).toBeNull();
    });
  });
});
