import { render, screen, waitFor } from '@testing-library/react';

import { StackWorkProvider, useStackWork } from './StackWorkProvider';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({})),
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  getTranslationBlocksAround: jest.fn(),
}));

const clientGraphql = jest.requireMock('@eightyfourthousand/client-graphql') as {
  getPassageMetaPage: jest.Mock;
};

/** One page of a section's identities. */
const page = (prefix: string, type: string, count: number) => ({
  metas: Array.from({ length: count }, (_, i) => ({
    uuid: `${prefix}${i}`,
    label: `${i + 1}`,
    sort: i,
    type,
    toh: undefined,
  })),
  hasMoreAfter: false,
  hasMoreBefore: false,
});

const Probe = () => {
  const stack = useStackWork();
  if (!stack) return <div>seeding</div>;
  return (
    <div>
      <span data-testid="spine">{stack.work.spine.uuids().join(',')}</span>
      <span data-testid="main">
        {stack.controllerFor('translation')?.getOrder().join(',')}
      </span>
      <span data-testid="notes">
        {stack.controllerFor('endnotes')?.getOrder().join(',')}
      </span>
      <span data-testid="front">{String(stack.controllerFor('front'))}</span>
    </div>
  );
};

describe('StackWorkProvider', () => {
  beforeEach(() => clientGraphql.getPassageMetaPage.mockReset());

  it('holds back until the sections are seeded', () => {
    clientGraphql.getPassageMetaPage.mockReturnValue(new Promise(() => undefined));

    render(
      <StackWorkProvider workUuid="w1">
        <Probe />
      </StackWorkProvider>,
    );

    expect(screen.getByText('seeding')).toBeTruthy();
  });

  // Order is load bearing: a run with nothing in it yet is appended at the end
  // of the spine, so seeding the back matter first would put it before the body.
  it('seeds the sections in the order the work reads', async () => {
    clientGraphql.getPassageMetaPage
      .mockResolvedValueOnce(page('p', 'translation', 2))
      .mockResolvedValueOnce(page('n', 'endnotes', 2));

    render(
      <StackWorkProvider workUuid="w1">
        <Probe />
      </StackWorkProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('spine').textContent).toBe('p0,p1,n0,n1'),
    );
  });

  it('gives each tab a view of its own passages', async () => {
    clientGraphql.getPassageMetaPage
      .mockResolvedValueOnce(page('p', 'translation', 2))
      .mockResolvedValueOnce(page('n', 'endnotes', 2));

    render(
      <StackWorkProvider workUuid="w1">
        <Probe />
      </StackWorkProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('main').textContent).toBe('p0,p1'),
    );
    expect(screen.getByTestId('notes').textContent).toBe('n0,n1');
  });

  it('reports nothing for a tab it does not draw', async () => {
    clientGraphql.getPassageMetaPage
      .mockResolvedValueOnce(page('p', 'translation', 1))
      .mockResolvedValueOnce(page('n', 'endnotes', 1));

    render(
      <StackWorkProvider workUuid="w1">
        <Probe />
      </StackWorkProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('front').textContent).toBe('null'),
    );
  });

  it('asks for each section separately', async () => {
    clientGraphql.getPassageMetaPage
      .mockResolvedValueOnce(page('p', 'translation', 1))
      .mockResolvedValueOnce(page('n', 'endnotes', 1));

    render(
      <StackWorkProvider workUuid="w1">
        <Probe />
      </StackWorkProvider>,
    );

    await waitFor(() =>
      expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledTimes(2),
    );
    const types = clientGraphql.getPassageMetaPage.mock.calls.map(
      (call) => call[0].type,
    );
    expect(types[types.length - 1]).toBe('endnotes');
  });
});
