/**
 * Annotation content sanitisation.
 *
 * `passage_annotations.content` is a jsonb ARRAY of objects (not a single object), and
 * many entries still carry deprecated `*_xmlId` references left over from the TEI
 * import. DEV-557 deliberately gave the published tables no xmlId columns, so the
 * published layer is UUID-only; these keys are stripped from the jsonb too.
 *
 * Stripping is safe because nothing resolves them at render time: `lookup.ts` matches
 * xmlIds against the *draft* tables, and the `migrate-glossary-instances`,
 * `migrate-endnotes`, and `migrate-passage-refs` scripts already backfilled `uuid`
 * alongside every `*_xmlId` on the reader-critical types.
 *
 * Where stripping would leave an annotation with no reference at all, that is a hard
 * validation failure rather than a silent drop — see validate.ts.
 */

import type { DraftAnnotation } from './types';

const XML_ID_KEY = /_xmlId$/;

/** Annotation types the reader already excludes (`get_passages_page` filters these). */
export const isDeprecatedType = (type: string): boolean =>
  type.startsWith('deprecated');

/**
 * Reference-bearing types whose target must resolve inside the published snapshot.
 * Deprecated types are excluded from the artifact entirely, so they are absent here.
 */
export const REFERENCE_TYPES = [
  'glossary-instance',
  'end-note-link',
  'mention',
  'internal-link',
  'abbreviation',
  'has-abbreviation',
] as const;

export type ReferenceType = (typeof REFERENCE_TYPES)[number];

export const isReferenceType = (type: string): type is ReferenceType =>
  (REFERENCE_TYPES as readonly string[]).includes(type);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Content is an array of single- or multi-key objects; tolerate anything else. */
const contentEntries = (content: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(content)) {
    return isRecord(content) ? [content] : [];
  }
  return content.filter(isRecord);
};

/** Every key present anywhere in the content array. */
export const contentKeys = (content: unknown): string[] =>
  contentEntries(content).flatMap((entry) => Object.keys(entry));

/** First value for `key` found anywhere in the content array. */
export const contentValue = (content: unknown, key: string): unknown => {
  for (const entry of contentEntries(content)) {
    if (key in entry && entry[key] !== null && entry[key] !== undefined) {
      return entry[key];
    }
  }
  return undefined;
};

export const contentUuid = (content: unknown): string | null => {
  const value = contentValue(content, 'uuid');
  return typeof value === 'string' && value.length ? value : null;
};

export const hasXmlIdKeys = (content: unknown): boolean =>
  contentKeys(content).some((key) => XML_ID_KEY.test(key));

/**
 * Removes every `*_xmlId` key, dropping entries that become empty.
 *
 * Preserves the array-of-objects shape and the order of surviving entries so the
 * published jsonb stays structurally identical to the draft apart from the removals.
 */
export const stripXmlIds = (content: unknown): unknown => {
  if (!Array.isArray(content)) {
    if (!isRecord(content)) {
      return content;
    }
    const stripped = stripEntry(content);
    return stripped ?? {};
  }

  return content
    .map((entry) => (isRecord(entry) ? stripEntry(entry) : entry))
    .filter((entry) => entry !== null);
};

const stripEntry = (
  entry: Record<string, unknown>,
): Record<string, unknown> | null => {
  const kept = Object.entries(entry).filter(([key]) => !XML_ID_KEY.test(key));
  return kept.length ? Object.fromEntries(kept) : null;
};

/**
 * True when stripping xmlIds would leave nothing usable behind.
 *
 * "Usable" means the annotation still carries some content: either a uuid or any other
 * non-xmlId key (styling annotations such as `span` legitimately carry no reference).
 * An annotation whose content was empty to begin with is fine — plenty of structural
 * types (`line`, `paragraph`) have none — so only annotations that had xmlIds and lose
 * everything are reported.
 */
export const isOrphanedByStrip = (content: unknown): boolean => {
  if (!hasXmlIdKeys(content)) {
    return false;
  }

  const stripped = stripXmlIds(content);
  return contentKeys(stripped).length === 0;
};

export const sanitizeAnnotation = (
  annotation: DraftAnnotation,
): DraftAnnotation => ({
  ...annotation,
  content: stripXmlIds(annotation.content),
});
