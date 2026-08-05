import { render, screen, waitFor } from '@testing-library/react';
import { PublishingPanel } from './PublishingPanel';

const mockHasPermission = jest.fn();
const mockGetPublishHistory = jest.fn();

jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  hasPermission: (args: unknown) => mockHasPermission(args),
  getPublishHistory: (args: unknown) => mockGetPublishHistory(args),
}));

// Exercised by their own suites; here only the gating and wiring matter.
jest.mock('./PublishChecksPanel', () => ({
  PublishChecksPanel: () => <div>Checks</div>,
}));
jest.mock('./PublishDialog', () => ({
  PublishDialog: ({ suggestedVersion }: { suggestedVersion: string | null }) => (
    <div>{`Dialog suggesting ${suggestedVersion}`}</div>
  ),
}));

const WORK = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPermission.mockResolvedValue(true);
  mockGetPublishHistory.mockResolvedValue({
    workUuid: WORK,
    versions: [],
    suggestedVersion: '0.0.4',
    suggestedVersionError: null,
  });
});

describe('PublishingPanel', () => {
  it('offers the publish action to an editor.admin', async () => {
    render(<PublishingPanel workUuid={WORK} workLabel="toh251" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Publish/ })).toBeTruthy(),
    );
    expect(mockHasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'EDITOR_ADMIN' }),
    );
  });

  it('hides the publish action from an editor without editor.admin', async () => {
    mockHasPermission.mockResolvedValue(false);

    render(<PublishingPanel workUuid={WORK} workLabel="toh251" />);

    // The checks panel still renders — only publishing is restricted.
    await waitFor(() => expect(screen.getByText('Checks')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Publish/ })).toBeNull();
    expect(screen.queryByText('Version history')).toBeNull();
  });

  it('does not read the history for a user who cannot publish', async () => {
    // The query requires editor.admin, so asking would only produce a failed request.
    mockHasPermission.mockResolvedValue(false);

    render(<PublishingPanel workUuid={WORK} workLabel="toh251" />);

    await waitFor(() => expect(screen.getByText('Checks')).toBeTruthy());
    expect(mockGetPublishHistory).not.toHaveBeenCalled();
  });

  it('hides the publish action when the permission check itself fails', async () => {
    // Failing closed: offering a control that will be refused is worse than not offering it.
    mockHasPermission.mockRejectedValue(new Error('network'));

    render(<PublishingPanel workUuid={WORK} workLabel="toh251" />);

    await waitFor(() => expect(screen.getByText('Checks')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Publish/ })).toBeNull();
  });

  it('passes the suggested version through to the dialog', async () => {
    render(<PublishingPanel workUuid={WORK} workLabel="toh251" />);

    await waitFor(() =>
      expect(screen.getByText('Dialog suggesting 0.0.4')).toBeTruthy(),
    );
  });

  it('reports an unreadable history as unavailable, not as never published', async () => {
    mockGetPublishHistory.mockResolvedValue(null);

    render(<PublishingPanel workUuid={WORK} workLabel="toh251" />);

    await waitFor(() =>
      expect(
        screen.getByText('The version history could not be loaded.'),
      ).toBeTruthy(),
    );
  });
});
