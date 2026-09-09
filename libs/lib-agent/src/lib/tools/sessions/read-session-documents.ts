import { z } from 'zod';
import type { DataClient, SessionStage } from '@eightyfourthousand/data-access';
import {
  SESSION_STAGES,
  hasPermission,
  invalidSessionFilenames,
  listSessionDocuments,
  readSessionDocuments,
  sessionPath,
  sessionToh,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from '../read/util';

const inputSchema = {
  toh: z.string().describe('Tohoku number of the work, e.g. "toh345".'),
  stage: z
    .enum(SESSION_STAGES)
    .optional()
    .describe('Limit to one stage. Omit to cover every stage of the work.'),
  names: z
    .array(z.string())
    .optional()
    .describe(
      'Filenames to read, e.g. ["toh345_stage0.md"]. Requires `stage`. Omit to list what the work has without reading it.',
    ),
};

/**
 * Read tool for a session's working documents. Requires `harness.read`.
 *
 * With no names it lists the tree, so a session can see what an earlier one
 * left. With names it returns markdown and JSON inline, and anything binary as
 * a signed download URL for the client to fetch.
 */
export function createReadSessionDocumentsTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'read-session-documents',
    description:
      'Read the working documents of a translation session — Stage 0 records, Stage 1 drafts, collation reports, alignment records. Call with a toh to list what has been saved for that work; add a stage and names to read specific documents. Markdown and JSON come back as text; a .docx comes back as a download URL to fetch. Read the previous stage from here rather than assuming a local file survives from an earlier session.',
    inputSchema,
    annotations: {
      title: 'Read Session Documents',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: async (args) => {
      const {
        toh: requestedToh,
        stage,
        names,
      } = args as {
        toh: string;
        stage?: SessionStage;
        names?: string[];
      };

      const allowed = await hasPermission({
        client,
        permission: 'harness.read',
      });
      if (!allowed) {
        return errorResult(
          'This tool requires the harness.read permission on the current account.',
        );
      }

      const toh = sessionToh(requestedToh);
      if (!toh) {
        return errorResult(
          `"${requestedToh}" is not a Tohoku number, so it names no session folder.`,
        );
      }

      const invalid = invalidSessionFilenames(names ?? []);
      if (invalid.length) {
        return errorResult(
          `These are not valid document names: ${invalid.join(', ')}. A name is a plain filename, not a path.`,
        );
      }

      if (!names?.length) {
        const paths = await listSessionDocuments({ client, toh, stage });
        if (!paths) {
          return errorResult(`Could not list the documents for ${toh}.`);
        }
        return jsonResult({
          toh,
          ...(stage ? { stage } : {}),
          documents: paths,
        });
      }

      if (!stage) {
        return errorResult(
          'Reading documents by name needs a stage, because the same filename can exist in more than one.',
        );
      }

      const { documents, missing, failed } = await readSessionDocuments({
        client,
        paths: names.map((filename) => sessionPath({ toh, stage, filename })),
      });

      // A document that could not be read is not a document that was never
      // saved, and must never be reported as one: a stage told its predecessor
      // produced nothing would start over and discard that work.
      if (failed.length) {
        return errorResult(
          `Could not read ${failed.map((f) => `${f.path} (${f.error})`).join(', ')}. These documents may well exist; do not treat them as unsaved.`,
        );
      }

      if (!documents.length) {
        return errorResult(
          `No document matched ${missing.join(', ')}. Call this tool without names to list what ${toh} has.`,
        );
      }

      return jsonResult({
        toh,
        stage,
        documents,
        ...(missing.length ? { missing } : {}),
      });
    },
  };
}
