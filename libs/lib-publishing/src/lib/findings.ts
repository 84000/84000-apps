/**
 * Rendering validation findings.
 *
 * The rules themselves live in SQL; this is only presentation, and is client-safe so
 * DEV-718's editor view can share it with the CLI.
 */

import type { ValidationFinding } from './types';

export const formatFindings = (findings: ValidationFinding[]): string =>
  findings
    .map((item) => {
      const head = `[${item.severity}] ${item.rule}: ${item.message}`;
      if (!item.subjects?.length) {
        return head;
      }
      const shown = item.subjects.join(', ');
      // The SQL rule set caps subjects at 20 while reporting the true count, so say so
      // rather than implying the list is complete.
      const omitted =
        item.count && item.count > item.subjects.length
          ? ` (+${item.count - item.subjects.length} more)`
          : '';
      return `${head}\n  ${item.count} affected: ${shown}${omitted}`;
    })
    .join('\n');
