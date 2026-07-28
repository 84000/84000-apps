import { latestVersion, nextVersion, parseVersion } from './version-label';

describe('parseVersion', () => {
  it('parses SemVer', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('rejects the two-part labels that exist in production', () => {
    expect(parseVersion('1.0')).toBeNull();
  });

  it('rejects non-numeric labels', () => {
    expect(parseVersion('v1.0.0')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('latestVersion', () => {
  it('orders numerically, not lexically', () => {
    expect(latestVersion(['0.0.2', '0.0.10', '0.0.9'])).toBe('0.0.10');
  });

  it('ignores unparseable labels', () => {
    expect(latestVersion(['1.0', '0.0.3'])).toBe('0.0.3');
  });

  it('returns null when nothing parses', () => {
    expect(latestVersion(['1.0', 'draft'])).toBeNull();
  });
});

describe('nextVersion', () => {
  it('patch-bumps the highest existing version', () => {
    const result = nextVersion({
      existingVersions: ['0.0.3', '0.0.4'],
      publicationVersion: '0.0.1',
    });
    expect(result).toEqual({ ok: true, version: '0.0.5' });
  });

  it('continues the legacy lineage on a first publish', () => {
    const result = nextVersion({
      existingVersions: [],
      publicationVersion: '0.0.2',
    });
    expect(result).toEqual({ ok: true, version: '0.0.3' });
  });

  it('starts at 0.0.1 when a work has never been published', () => {
    const result = nextVersion({
      existingVersions: [],
      publicationVersion: null,
    });
    expect(result).toEqual({ ok: true, version: '0.0.1' });
  });

  it('refuses to guess from a non-SemVer legacy label', () => {
    const result = nextVersion({
      existingVersions: [],
      publicationVersion: '1.0',
    });
    expect(result.ok).toBe(false);
  });

  it('refuses to guess when existing labels do not parse', () => {
    const result = nextVersion({
      existingVersions: ['1.0'],
      publicationVersion: null,
    });
    expect(result.ok).toBe(false);
  });

  it('accepts an explicit version', () => {
    const result = nextVersion({
      existingVersions: ['0.0.3'],
      publicationVersion: null,
      explicit: '1.0.0',
    });
    expect(result).toEqual({ ok: true, version: '1.0.0' });
  });

  it('rejects an explicit version that collides', () => {
    const result = nextVersion({
      existingVersions: ['1.0.0'],
      publicationVersion: null,
      explicit: '1.0.0',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an explicit version that is not SemVer', () => {
    const result = nextVersion({
      existingVersions: [],
      publicationVersion: null,
      explicit: '1.0',
    });
    expect(result.ok).toBe(false);
  });
});
