export type SemVer = `${number}.${number}.${number}`;

/**
 * Whether a publication version represents a published work. A major version
 * below 1 (e.g. `0.x.x`) is considered in-progress / not yet published.
 * An undefined or unparseable version is treated as published (don't gate).
 */
export const isPublishedVersion = (version?: SemVer): boolean => {
  if (!version) {
    return true;
  }
  const major = Number(version.split('.')[0]);
  return Number.isFinite(major) && major >= 1;
};
