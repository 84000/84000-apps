/**
 * Version label selection.
 *
 * Labels are SemVer by convention and unique per work. The house convention visible in
 * the data is patch-level bumps (0.0.2 -> 0.0.3 dominate), so that is the default
 * increment; `works."publicationVersion"` seeds the first real publish so reader-visible
 * numbering continues its existing lineage instead of resetting.
 */

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

export const parseVersion = (value: string): ParsedVersion | null => {
  const match = SEMVER.exec(value.trim());
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

export const formatVersion = ({ major, minor, patch }: ParsedVersion): string =>
  `${major}.${minor}.${patch}`;

export const bumpPatch = (version: ParsedVersion): ParsedVersion => ({
  ...version,
  patch: version.patch + 1,
});

/** Highest SemVer label among existing versions; null if none parse. */
export const latestVersion = (versions: string[]): string | null => {
  const parsed = versions
    .map((value) => ({ value, parsed: parseVersion(value) }))
    .filter(
      (entry): entry is { value: string; parsed: ParsedVersion } =>
        entry.parsed !== null,
    );

  if (!parsed.length) {
    return null;
  }

  parsed.sort((a, b) => {
    if (a.parsed.major !== b.parsed.major) return a.parsed.major - b.parsed.major;
    if (a.parsed.minor !== b.parsed.minor) return a.parsed.minor - b.parsed.minor;
    return a.parsed.patch - b.parsed.patch;
  });

  return parsed[parsed.length - 1].value;
};

export type NextVersionResult =
  | { ok: true; version: string }
  | { ok: false; error: string };

/**
 * Chooses the label for a new publish.
 *
 * Precedence: an explicit label wins (validated and checked for collisions); otherwise
 * patch-bump the highest existing `work_versions.version`; on a first publish,
 * patch-bump the legacy `publicationVersion`; with neither, start at 0.0.1.
 *
 * A legacy label that is not SemVer (e.g. `1.0`, which exists in production) is not
 * coerced — guessing whether that means 1.0.0 or 1.0.x is exactly the kind of
 * non-deterministic repair the project rules out, so it asks for an explicit label.
 */
export const nextVersion = ({
  existingVersions,
  publicationVersion,
  explicit,
}: {
  existingVersions: string[];
  publicationVersion: string | null;
  explicit?: string;
}): NextVersionResult => {
  if (explicit) {
    const parsed = parseVersion(explicit);
    if (!parsed) {
      return {
        ok: false,
        error: `Version "${explicit}" is not SemVer (expected MAJOR.MINOR.PATCH).`,
      };
    }
    if (existingVersions.includes(explicit)) {
      return {
        ok: false,
        error: `Version "${explicit}" already exists for this work.`,
      };
    }
    return { ok: true, version: explicit };
  }

  const latest = latestVersion(existingVersions);
  if (latest) {
    const parsed = parseVersion(latest);
    // Non-null: latestVersion only returns labels that parsed.
    return { ok: true, version: formatVersion(bumpPatch(parsed as ParsedVersion)) };
  }

  if (existingVersions.length) {
    return {
      ok: false,
      error:
        `This work has version labels that are not SemVer ` +
        `(${existingVersions.join(', ')}), so the next one cannot be inferred. ` +
        `Pass an explicit version.`,
    };
  }

  if (publicationVersion) {
    const parsed = parseVersion(publicationVersion);
    if (!parsed) {
      return {
        ok: false,
        error:
          `Legacy publicationVersion "${publicationVersion}" is not SemVer, so the ` +
          `first published version cannot be inferred. Pass an explicit version.`,
      };
    }
    return { ok: true, version: formatVersion(bumpPatch(parsed)) };
  }

  return { ok: true, version: '0.0.1' };
};
