import { render, screen } from '@testing-library/react';
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

describe('VersionHistory', () => {
  it('shows the label, publisher, and notes for each version', () => {
    render(
      <VersionHistory
        versions={[version({ version: '0.0.2', notes: 'Fixed the glossary' })]}
      />,
    );

    expect(screen.getByText('0.0.2')).toBeTruthy();
    expect(screen.getByText(/Dawa Lhamo/)).toBeTruthy();
    expect(screen.getByText('Fixed the glossary')).toBeTruthy();
  });

  it('marks the live version', () => {
    render(
      <VersionHistory
        versions={[
          version({ uuid: 'v2', version: '0.0.2', isLive: true }),
          version({ uuid: 'v1', version: '0.0.1' }),
        ]}
      />,
    );

    expect(screen.getAllByText('Live')).toHaveLength(1);
  });

  it('does not claim a clean publish when validation was never recorded', () => {
    // The distinction the whole component exists to preserve: null warnings mean no job row
    // survives to read, which is not evidence that the publish was clean.
    render(<VersionHistory versions={[version({ warnings: null })]} />);

    expect(screen.getByText('Validation not recorded')).toBeTruthy();
    expect(screen.queryByText('Published clean')).toBeNull();
  });

  it('reports a publish that recorded no warnings as clean', () => {
    render(<VersionHistory versions={[version({ warnings: [] })]} />);

    expect(screen.getByText('Published clean')).toBeTruthy();
  });

  it('counts warning occurrences rather than rules', () => {
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

    expect(screen.getByText('Published with 37 warnings')).toBeTruthy();
  });

  it('distinguishes never published from could not load', () => {
    const { rerender } = render(<VersionHistory versions={[]} />);
    expect(screen.getByText('This work has not been published yet.')).toBeTruthy();

    rerender(<VersionHistory versions={[]} unavailable />);
    expect(
      screen.getByText('The version history could not be loaded.'),
    ).toBeTruthy();
    expect(screen.queryByText('This work has not been published yet.')).toBeNull();
  });

  it('leaves a service-account publish unattributed', () => {
    render(
      <VersionHistory
        versions={[version({ publishedBy: null, publisher: null })]}
      />,
    );

    // No uuid rendered as a stand-in for a name.
    expect(screen.queryByText(/user-1/)).toBeNull();
  });
});
