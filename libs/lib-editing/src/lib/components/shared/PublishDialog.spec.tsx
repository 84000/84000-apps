import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublishJob } from '@eightyfourthousand/client-graphql';
import { PublishDialog } from './PublishDialog';
import type { PublishVerdict } from './PublishChecksPanel';

const mockPublishWork = jest.fn();
const mockGetPublishJob = jest.fn();
const mockAdvancePublishJob = jest.fn();

jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  publishWork: (args: unknown) => mockPublishWork(args),
  getPublishJob: (args: unknown) => mockGetPublishJob(args),
  advancePublishJob: (args: unknown) => mockAdvancePublishJob(args),
}));

const job = (overrides: Partial<PublishJob> = {}): PublishJob => ({
  uuid: 'job-1',
  workUuid: 'work-1',
  versionUuid: 'v3',
  version: '0.0.3',
  status: 'SUCCEEDED',
  phase: 'DONE',
  done: true,
  counts: null,
  warnings: [],
  errors: [],
  error: null,
  createdAt: '2026-08-04T10:00:00.000Z',
  updatedAt: '2026-08-04T10:00:01.000Z',
  finishedAt: '2026-08-04T10:00:01.000Z',
  ...overrides,
});

const CLEAN: PublishVerdict = {
  ok: true,
  undetermined: false,
  checkedAt: '2026-08-04T10:00:00.000Z',
};

const onPublished = jest.fn();

// This project does not load jest-dom, so element state is read directly.
const publishButton = () =>
  screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement;

const renderDialog = (
  props: Partial<React.ComponentProps<typeof PublishDialog>> = {},
) =>
  render(
    <PublishDialog
      open
      onOpenChange={jest.fn()}
      work="work-1"
      workLabel="toh251"
      verdict={CLEAN}
      suggestedVersion="0.0.3"
      suggestedVersionError={null}
      onPublished={onPublished}
      {...props}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockPublishWork.mockResolvedValue({ job: job(), error: null });
});

describe('PublishDialog', () => {
  it('pre-fills the version the pipeline would choose', () => {
    renderDialog();

    expect((screen.getByLabelText('Version') as HTMLInputElement).value).toBe(
      '0.0.3',
    );
  });

  it('sends the version and notes as entered', async () => {
    renderDialog();

    const version = screen.getByLabelText('Version');
    await userEvent.clear(version);
    await userEvent.type(version, '0.1.0');
    await userEvent.type(
      screen.getByLabelText('Notes (optional)'),
      'Glossary pass',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(mockPublishWork).toHaveBeenCalledWith(
      expect.objectContaining({
        work: 'work-1',
        version: '0.1.0',
        notes: 'Glossary pass',
      }),
    );
  });

  it('omits an empty version so the pipeline picks one', async () => {
    renderDialog({ suggestedVersion: null });

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(mockPublishWork).toHaveBeenCalledWith(
      expect.objectContaining({ version: undefined, notes: undefined }),
    );
  });

  it('refuses to publish a work with blocking findings', async () => {
    renderDialog({
      verdict: { ok: false, undetermined: false, checkedAt: CLEAN.checkedAt },
    });

    expect(publishButton().disabled).toBe(true);
    expect(screen.getByText(/findings that block publication/)).toBeTruthy();
    await userEvent.click(publishButton());
    expect(mockPublishWork).not.toHaveBeenCalled();
  });

  it('refuses to publish an unchecked work, and says so differently', async () => {
    // Unchecked and blocked have different remedies — run the check versus fix the findings —
    // so telling an editor their work is broken when nothing was looked at would be wrong.
    renderDialog({ verdict: null });

    expect(publishButton().disabled).toBe(true);
    expect(screen.getByText(/has not been checked/)).toBeTruthy();
    expect(screen.queryByText(/findings that block publication/)).toBeNull();
  });

  it('refuses to publish when the checks could not be evaluated', async () => {
    renderDialog({ verdict: { ok: false, undetermined: true, checkedAt: null } });

    expect(publishButton().disabled).toBe(true);
    expect(screen.getByText(/could not be evaluated/)).toBeTruthy();
  });

  it('reports a refusal from the server without claiming anything was published', async () => {
    mockPublishWork.mockResolvedValue({
      job: null,
      error: 'Version "0.0.3" already exists for this work.',
    });
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(
        screen.getByText('Version "0.0.3" already exists for this work.'),
      ).toBeTruthy(),
    );
    expect(onPublished).not.toHaveBeenCalled();
  });

  it('says the previous version is still live when a publish fails', async () => {
    // The fear this addresses directly: that a failed publish left readers on a half-written
    // version. The pipeline's only commit point is the pointer flip, so it did not.
    mockPublishWork.mockResolvedValue({
      job: job({
        status: 'FAILED',
        phase: 'VALIDATE',
        error: 'Validation failed.',
        errors: [
          {
            rule: 'glossary-instance-unresolved',
            severity: 'error',
            message: 'Glossary references that do not resolve',
            subjects: ['a'],
            count: 4,
          },
        ],
      }),
      error: null,
    });
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(screen.getByText('Publish failed')).toBeTruthy());
    expect(screen.getByText(/still live and serving/)).toBeTruthy();
    expect(onPublished).not.toHaveBeenCalled();
  });

  it('lets the editor correct a rejected version label without reopening', async () => {
    // A label collision arrives as a FAILED job with no validation errors, not as a thrown
    // error — and it is the likeliest way a publish fails, so the fix has to be reachable
    // from here. Message text is what the pipeline actually returns.
    mockPublishWork.mockResolvedValueOnce({
      job: job({
        status: 'FAILED',
        phase: 'SNAPSHOT',
        version: null,
        error: 'Version "1.1.0" already exists for this work.',
      }),
      error: null,
    });
    renderDialog();

    await userEvent.click(publishButton());
    await waitFor(() =>
      expect(
        screen.getByText('Version "1.1.0" already exists for this work.'),
      ).toBeTruthy(),
    );

    // The form is still there, pre-filled, and offering a retry rather than only a close.
    const retry = screen.getByRole('button', { name: 'Try again' });
    const versionField = screen.getByLabelText('Version') as HTMLInputElement;
    await userEvent.clear(versionField);
    await userEvent.type(versionField, '1.1.1');

    mockPublishWork.mockResolvedValueOnce({
      job: job({ version: '1.1.1' }),
      error: null,
    });
    await userEvent.click(retry);

    await waitFor(() => expect(screen.getByText('Published 1.1.1')).toBeTruthy());
    expect(mockPublishWork).toHaveBeenLastCalledWith(
      expect.objectContaining({ version: '1.1.1' }),
    );
  });

  it('offers no retry for a validation hard-fail, which is not fixable here', async () => {
    // The remedy is in the text, not in this dialog; a retry button would only invite a
    // pointless re-submission of the same broken draft.
    mockPublishWork.mockResolvedValue({
      job: job({
        status: 'FAILED',
        phase: 'VALIDATE',
        error: 'Validation failed. Nothing was written.',
        errors: [
          {
            rule: 'inline-marker-unresolved',
            severity: 'error',
            message:
              'Inline markers reference passages, bibliography entries, or glossary terms that are not part of this snapshot.',
            subjects: ['9c716be4-2773-4440-8216-f8aec2cbe52a'],
            count: 1,
          },
        ],
      }),
      error: null,
    });
    renderDialog();

    await userEvent.click(publishButton());

    await waitFor(() => expect(screen.getByText('Publish failed')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByLabelText('Version')).toBeNull();
    // Dismissal only. ("Close" also matches the dialog's own X, hence getAll.)
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0);
    expect(screen.getByText(/still live and serving/)).toBeTruthy();
  });

  it('reports success and refreshes history once', async () => {
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(screen.getByText('Published 0.0.3')).toBeTruthy());
    expect(onPublished).toHaveBeenCalledTimes(1);
    // Nothing to poll for: the job came back terminal.
    expect(mockGetPublishJob).not.toHaveBeenCalled();
  });

  it('surfaces warnings on success while making clear they did not block', async () => {
    mockPublishWork.mockResolvedValue({
      job: job({
        warnings: [
          {
            rule: 'xmlid-stripped',
            severity: 'warning',
            message: 'Deprecated xmlIds',
            subjects: [],
            count: 12,
          },
        ],
      }),
      error: null,
    });
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(screen.getByText('Published 0.0.3')).toBeTruthy());
    expect(screen.getByText(/do not block publication/)).toBeTruthy();
  });

  it('keeps watching a job that is still running', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockPublishWork.mockResolvedValue({
      job: job({ status: 'RUNNING', phase: 'ARTIFACT', done: false }),
      error: null,
    });
    mockGetPublishJob.mockResolvedValue(job());
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(screen.getByText('Writing the artifact…')).toBeTruthy(),
    );

    jest.advanceTimersByTime(2000);

    await waitFor(() => expect(mockGetPublishJob).toHaveBeenCalled());
    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    jest.useRealTimers();
  });

  it('does not treat a failed poll as a failed publish', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockPublishWork.mockResolvedValue({
      job: job({ status: 'RUNNING', phase: 'SNAPSHOT', done: false }),
      error: null,
    });
    // The job row remains the record of what happened; one unanswered poll changes nothing.
    mockGetPublishJob.mockResolvedValue(null);
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    jest.advanceTimersByTime(4000);

    await waitFor(() => expect(mockGetPublishJob).toHaveBeenCalled());
    expect(screen.queryByText('Publish failed')).toBeNull();
    expect(screen.getByText('Copying the draft…')).toBeTruthy();
    jest.useRealTimers();
  });
});
