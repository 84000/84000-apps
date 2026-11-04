import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

import { StackController } from './StackController';
import { StackReaderProvider } from './StackReaderProvider';
import {
  StackWorkContextProvider,
  useStackWork,
  useStackWorkLoad,
  type LoadedStackWork,
  type StackViewFactory,
} from './stack-work-context';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({})),
  getPassageMetaPage: jest.fn(async () => ({
    metas: [],
    hasMoreAfter: false,
    hasMoreBefore: false,
  })),
  getTranslationBlocks: jest.fn(),
  getTranslationBlocksAround: jest.fn(),
}));

// The draft read itself, so the bibliography loader runs for real above it.
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: jest.fn(() => ({})),
  getBibliographyRows: jest.fn(async () => []),
}));

const { getBibliographyRows } = jest.requireMock(
  '@eightyfourthousand/data-access',
) as { getBibliographyRows: jest.Mock };

const Loaded = () => {
  const stack = useStackWork();
  return stack ? <span data-testid="loaded" /> : null;
};

const createView: StackViewFactory = (options) => new StackController(options);

/** The loader as a host that asks for nothing but its defaults uses it. */
const DefaultLoad = ({ children }: { children: React.ReactNode }) => {
  const [stack, setStack] = useState<LoadedStackWork | null>(null);
  useStackWorkLoad({
    workUuid: 'w1',
    readOnly: true,
    stack,
    setStack,
    createView,
  });
  return (
    <StackWorkContextProvider stack={stack} readOnly>
      {children}
    </StackWorkContextProvider>
  );
};

beforeEach(() => getBibliographyRows.mockClear());

describe('StackReaderProvider', () => {
  it('never reads the draft bibliography', async () => {
    render(
      <StackReaderProvider workUuid="w1">
        <Loaded />
      </StackReaderProvider>,
    );

    await screen.findByTestId('loaded');
    expect(getBibliographyRows).not.toHaveBeenCalled();
  });

  it('leaves the editor reading it, as it did', async () => {
    render(
      <DefaultLoad>
        <Loaded />
      </DefaultLoad>,
    );

    await screen.findByTestId('loaded');
    await waitFor(() =>
      expect(getBibliographyRows).toHaveBeenCalledWith(
        expect.objectContaining({ workUuid: 'w1' }),
      ),
    );
  });
});
