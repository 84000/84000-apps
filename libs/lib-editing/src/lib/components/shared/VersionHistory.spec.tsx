import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WorkVersion } from '@eightyfourthousand/client-graphql';
import { VersionHistory } from './VersionHistory';

const version = (overrides: Partial<WorkVersion> = {}): WorkVersion => ({
  uuid: 'v1',
  version: '0.0.1',
  publishedAt: '2026-08-01T10:00:00.000Z',
  publishedBy: 'user-1',
  publisher: 'Dawa Lhamo',
  notes: null,
  isLive: false,
  warnings: [],
  ...overrides,
});

/**
 * Opens the collapsed list.
 *
 * A list of versions starts collapsed, so every assertion about a row's contents has to
 * expand first — and assertions about ABSENCE especially, since a collapsed list would
 * satisfy them without proving anything.
 */
const expand = () =>
  userEvent.click(screen.getByRole('button', { name: /Version history/ }));

describe('VersionHistory', () => {
  it('shows the label, publisher, and notes for each version', async () => {
    render(
      <VersionHistory
        versions={[version({ version: '0.0.2', notes: 'Fixed the glossary' })]}
      />,
    );
    await expand();

    expect(screen.getByText('0.0.2')).toBeTruthy();
    expect(screen.getByText(/Dawa Lhamo/)).toBeTruthy();
    expect(screen.getByText('Fixed the glossary')).toBeTruthy();
  });

  it('marks the live version', async () => {
    render(
      <VersionHistory
        versions={[
          version({ uuid: 'v2', version: '0.0.2', isLive: true }),
          version({ uuid: 'v1', version: '0.0.1' }),
        ]}
      />,
    );
    await expand();

    expect(screen.getAllByText('Live')).toHaveLength(1);
  });

  it('does not claim a clean publish when validation was never recorded', async () => {
    // The distinction the whole component exists to preserve: null warnings mean no job row
    // survives to read, which is not evidence that the publish was clean.
    render(<VersionHistory versions={[version({ warnings: null })]} />);
    await expand();

    expect(screen.getByText('Validation not recorded')).toBeTruthy();
    expect(screen.queryByText('Published clean')).toBeNull();
  });

  it('reports a publish that recorded no warnings as clean', async () => {
    render(<VersionHistory versions={[version({ warnings: [] })]} />);
    await expand();

    expect(screen.getByText('Published clean')).toBeTruthy();
  });

  it('counts warning occurrences rather than rules', async () => {
    // A finding carries the true total, which exceeds its capped subject list, so summing
    // counts is the honest number.
    render(
      <VersionHistory
        versions={[
          version({
            warnings: [
              {
                rule: 'xmlid-stripped',
                severity: 'warning',
                message: 'Deprecated xmlIds',
                subjects: ['a', 'b'],
                count: 37,
              },
            ],
          }),
        ]}
      />,
    );
    await expand();

    expect(screen.getByText('Published with 37 warnings')).toBeTruthy();
  });

  it('distinguishes never published from could not load', () => {
    // Both are a single line, so both start expanded — hiding the answer behind a click
    // would not be tidying anything away.
    const { rerender } = render(<VersionHistory versions={[]} />);
    expect(
      screen.getByText('This work has not been published yet.'),
    ).toBeTruthy();

    rerender(<VersionHistory versions={[]} unavailable />);
    expect(
      screen.getByText('The version history could not be loaded.'),
    ).toBeTruthy();
    expect(
      screen.queryByText('This work has not been published yet.'),
    ).toBeNull();
  });

  it('leaves a service-account publish unattributed', async () => {
    render(
      <VersionHistory
        versions={[version({ publishedBy: null, publisher: null })]}
      />,
    );
    await expand();

    // Expanded first, so this proves the uuid is absent rather than merely hidden.
    expect(screen.getByText('0.0.1')).toBeTruthy();
    expect(screen.queryByText(/user-1/)).toBeNull();
  });

  it('starts collapsed when there is a list to hide, and says how many', async () => {
    render(
      <VersionHistory
        versions={[
          version({ uuid: 'v2', version: '0.0.2' }),
          version({ uuid: 'v1', version: '0.0.1' }),
        ]}
      />,
    );

    // The count is readable while closed, so collapsing costs no information.
    expect(screen.getByText('(2)')).toBeTruthy();
    expect(screen.queryByText('0.0.2')).toBeNull();

    await expand();
    expect(screen.getByText('0.0.2')).toBeTruthy();
  });

  it('collapses again on a second click', async () => {
    render(<VersionHistory versions={[version({ version: '0.0.2' })]} />);

    await expand();
    expect(screen.getByText('0.0.2')).toBeTruthy();

    await expand();
    expect(screen.queryByText('0.0.2')).toBeNull();
  });
});
