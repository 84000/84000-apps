/**
 * Publish validation.
 *
 * Partial-fail rules from the project description: hard fail for broken reader-critical
 * references, warn for non-critical metadata, and no non-deterministic auto-repair —
 * nothing here rewrites or invents data, it only reports.
 *
 * Everything is checked against the snapshot that is about to be written, not against
 * the wider database, because the published snapshot is what readers will resolve
 * against. A reference that only resolves via a draft-only row is broken once published.
 */

import {
  contentUuid,
  contentValue,
  isDeprecatedType,
  isOrphanedByStrip,
  isReferenceType,
} from './sanitize';
import type {
  DraftWork,
  ValidationFinding,
  ValidationResult,
} from './types';

/** Cap on uuids listed per finding, so a systemic failure stays readable. */
const MAX_SUBJECTS = 20;

const finding = ({
  severity,
  rule,
  message,
  subjects,
}: {
  severity: 'error' | 'warning';
  rule: string;
  message: string;
  subjects: string[];
}): ValidationFinding => ({
  severity,
  rule,
  message,
  subjects: subjects.slice(0, MAX_SUBJECTS),
  count: subjects.length,
});

export const validateDraftWork = (draft: DraftWork): ValidationResult => {
  const errors: ValidationFinding[] = [];
  const warnings: ValidationFinding[] = [...(draft.readWarnings ?? [])];

  // Annotations of deprecated types never reach the artifact, so they are excluded from
  // every check below — matching the reader, which already filters `deprecated%`.
  const annotations = draft.annotations.filter(
    (annotation) => !isDeprecatedType(annotation.type),
  );

  const passageUuids = new Set(draft.passages.map((passage) => passage.uuid));
  const glossaryUuids = new Set(
    draft.glossary.map((term) => term.glossary_uuid),
  );
  const bibliographyUuids = new Set(
    draft.bibliographies.map((entry) => entry.uuid),
  );

  // --- passage ordering is complete -----------------------------------------

  if (!draft.passages.length) {
    errors.push({
      severity: 'error',
      rule: 'passages-empty',
      message: 'The work has no passages, so there is nothing to publish.',
    });
  }

  const unsorted = draft.passages.filter((passage) => passage.sort === null);
  if (unsorted.length) {
    errors.push(
      finding({
        severity: 'error',
        rule: 'passage-sort-missing',
        message:
          'Passages have no sort value, so published ordering would be arbitrary.',
        subjects: unsorted.map((passage) => passage.uuid),
      }),
    );
  }

  const seenSort = new Map<number, string[]>();
  for (const passage of draft.passages) {
    if (passage.sort === null) continue;
    const existing = seenSort.get(passage.sort);
    if (existing) {
      existing.push(passage.uuid);
    } else {
      seenSort.set(passage.sort, [passage.uuid]);
    }
  }
  const duplicateSorts = [...seenSort.values()].filter(
    (uuids) => uuids.length > 1,
  );
  if (duplicateSorts.length) {
    errors.push(
      finding({
        severity: 'error',
        rule: 'passage-sort-duplicate',
        message:
          'Passages share a sort value, so published ordering is not deterministic.',
        subjects: duplicateSorts.flat(),
      }),
    );
  }

  // --- glossary-instance annotations resolve to glossary entries -------------
  //
  // Verified against production: glossary-instance references never resolve
  // cross-work, so the work's own snapshot is always sufficient to check them.

  const unresolvedGlossary = annotations.filter((annotation) => {
    if (annotation.type !== 'glossary-instance') return false;
    const uuid = contentUuid(annotation.content);
    return uuid === null || !glossaryUuids.has(uuid);
  });
  if (unresolvedGlossary.length) {
    errors.push(
      finding({
        severity: 'error',
        rule: 'glossary-instance-unresolved',
        message:
          'glossary-instance annotations reference glossary terms that are not in ' +
          'this work’s published glossary. Clean up the annotations or the ' +
          'glossary before publishing.',
        subjects: unresolvedGlossary.map((annotation) => annotation.uuid),
      }),
    );
  }

  // --- inline markers resolve inside the published snapshot ------------------
  //
  // Only markers that are *intrinsically* local are required to resolve here.
  // Verified against production, because the obvious reading of the data is wrong:
  //
  //   end-note-link          54,659 of 54,663 target the same work -> always local
  //   abbreviation           all 1,663 target the same work        -> always local
  //   has-abbreviation       all 1,663 target the same work        -> always local
  //   mention                with same_work absent, 6,800 of 7,362 target ANOTHER
  //                          work — absent does not mean same-work, it usually means
  //                          cross-work
  //   internal-link          258 of 1,432 target another work
  //
  // So mention and internal-link are only checked when same_work is explicitly true.
  // Treating an absent flag as same-work would hard-fail 167 works whose cross-work
  // links are perfectly valid. Note also that same_work: false is not trustworthy in
  // the other direction (3 such mentions do target the same work), which is why it is
  // opt-in rather than opt-out.
  const ALWAYS_LOCAL_TYPES = ['end-note-link', 'abbreviation', 'has-abbreviation'];

  const unresolvedPassageRefs = annotations.filter((annotation) => {
    if (!isReferenceType(annotation.type)) return false;
    if (annotation.type === 'glossary-instance') return false;

    const uuid = contentUuid(annotation.content);
    if (uuid === null) {
      // No uuid at all is reported by the xmlId-orphan rule below when it stems from
      // stripping; otherwise it is a reference that never had a target.
      return false;
    }

    const isAlwaysLocal = ALWAYS_LOCAL_TYPES.includes(annotation.type);
    const declaredSameWork =
      contentValue(annotation.content, 'same_work') === true;
    if (!isAlwaysLocal && !declaredSameWork) return false;

    // Works and folios are not part of a work's published snapshot; glossary targets
    // resolve against the published glossary rather than the passage list.
    const target = contentValue(annotation.content, 'type');
    if (target === 'work' || target === 'folio') return false;
    if (target === 'glossary') return !glossaryUuids.has(uuid);

    return !passageUuids.has(uuid) && !bibliographyUuids.has(uuid);
  });
  if (unresolvedPassageRefs.length) {
    errors.push(
      finding({
        severity: 'error',
        rule: 'inline-marker-unresolved',
        message:
          'Inline markers reference passages or bibliography entries that are not ' +
          'part of this snapshot.',
        subjects: unresolvedPassageRefs.map((annotation) => annotation.uuid),
      }),
    );
  }

  const danglingAnnotations = annotations.filter(
    (annotation) => !passageUuids.has(annotation.passage_uuid),
  );
  if (danglingAnnotations.length) {
    errors.push(
      finding({
        severity: 'error',
        rule: 'annotation-passage-missing',
        message:
          'Annotations belong to passages that are not part of this snapshot.',
        subjects: danglingAnnotations.map((annotation) => annotation.uuid),
      }),
    );
  }

  // --- no draft-only references leak into published artifacts ----------------
  //
  // *_xmlId keys are stripped (published tables are UUID-only). Where stripping would
  // leave an annotation with no content at all, the annotation cannot be published
  // without silently losing it — a hard fail rather than a quiet drop.

  const orphanedByStrip = annotations.filter((annotation) =>
    isOrphanedByStrip(annotation.content),
  );
  if (orphanedByStrip.length) {
    errors.push(
      finding({
        severity: 'error',
        rule: 'xmlid-strip-orphan',
        message:
          'Annotations reference targets only by deprecated xmlId, which is not ' +
          'carried into published content. Backfill their uuid before publishing.',
        subjects: orphanedByStrip.map((annotation) => annotation.uuid),
      }),
    );
  }

  const strippedXmlIds = annotations.filter(
    (annotation) =>
      !isOrphanedByStrip(annotation.content) &&
      contentUuid(annotation.content) !== null &&
      /_xmlId/.test(JSON.stringify(annotation.content ?? null)),
  );
  if (strippedXmlIds.length) {
    warnings.push(
      finding({
        severity: 'warning',
        rule: 'xmlid-stripped',
        message:
          'Deprecated *_xmlId keys were removed from annotation content; each of ' +
          'these annotations still resolves by uuid.',
        subjects: strippedXmlIds.map((annotation) => annotation.uuid),
      }),
    );
  }

  // --- bibliography refs resolve --------------------------------------------

  const danglingHeadings = draft.bibliographies.filter(
    (entry) =>
      entry.heading_uuid !== null && !bibliographyUuids.has(entry.heading_uuid),
  );
  if (danglingHeadings.length) {
    errors.push(
      finding({
        severity: 'error',
        rule: 'bibliography-heading-unresolved',
        message:
          'Bibliography entries point at heading rows that are not part of this ' +
          'snapshot.',
        subjects: danglingHeadings.map((entry) => entry.uuid),
      }),
    );
  }

  // --- non-critical metadata ------------------------------------------------

  if (!draft.bibliographies.length) {
    warnings.push({
      severity: 'warning',
      rule: 'bibliography-empty',
      message: 'The work has no bibliography entries.',
    });
  }

  if (!draft.glossary.length) {
    warnings.push({
      severity: 'warning',
      rule: 'glossary-empty',
      message: 'The work has no glossary terms.',
    });
  }

  if (!draft.toh) {
    warnings.push({
      severity: 'warning',
      rule: 'toh-missing',
      message: 'The work has no Tohoku number.',
    });
  }

  const untitled = !draft.title || !draft.title.trim().length;
  if (untitled) {
    warnings.push({
      severity: 'warning',
      rule: 'title-missing',
      message: 'The work has no title.',
    });
  }

  const emptyPassages = draft.passages.filter(
    (passage) => !passage.content || !passage.content.trim().length,
  );
  if (emptyPassages.length) {
    warnings.push(
      finding({
        severity: 'warning',
        rule: 'passage-content-empty',
        message: 'Passages have no content.',
        subjects: emptyPassages.map((passage) => passage.uuid),
      }),
    );
  }

  return { ok: errors.length === 0, errors, warnings };
};

export const formatFindings = (findings: ValidationFinding[]): string =>
  findings
    .map((item) => {
      const head = `[${item.severity}] ${item.rule}: ${item.message}`;
      if (!item.subjects?.length) {
        return head;
      }
      const shown = item.subjects.join(', ');
      const omitted =
        item.count && item.count > item.subjects.length
          ? ` (+${item.count - item.subjects.length} more)`
          : '';
      return `${head}\n  ${item.count} affected: ${shown}${omitted}`;
    })
    .join('\n');
