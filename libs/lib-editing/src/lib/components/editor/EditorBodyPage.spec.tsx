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
jest.mock('../shared/BodyPanel', () => ({ BodyPanel: () => null }));
jest.mock('./TitlesBuilder', () => ({ TitlesBuilder: () => null }));
jest.mock('./EditorProvider', () => ({
  useEditorState: () => ({ work: { uuid: 'w1' } }),
}));
// The flag's value has not arrived.
jest.mock('./usePerPassageDocs', () => ({
  usePerPassageDocs: () => ({ enabled: false, ready: false }),
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  getTranslationBlocks: jest.Mock;
};

describe('EditorBodyPage', () => {
  // The paginated editor must not wait on the flag to start reading.
  it('reads the front matter at mount, before the flag settles', async () => {
    render(<EditorBodyPage />);

    await waitFor(() =>
      expect(clientGraphql.getTranslationBlocks).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'front' }),
      ),
    );
  });
});
