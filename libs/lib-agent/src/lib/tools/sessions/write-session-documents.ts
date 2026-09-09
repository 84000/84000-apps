import { z } from 'zod';
import type {
  DataClient,
  ManifestFile,
  SessionStage,
} from '@eightyfourthousand/data-access';
import {
  SESSION_STAGES,
  hasPermission,
  invalidSessionFilenames,
  prepareSessionUploads,
  reservedWriteNames,
  resolveToh,
  sessionPath,
  sessionToh,
  writeSessionManifest,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from '../read/util';

/** The SDK infers tool arguments loosely, so the handler restates their shape. */
type WriteFileInput = { filename: string; role: 'primary' | 'supporting' };

const inputSchema = {
  toh: z.string().describe('Tohoku number of the work, e.g. "toh345".'),
  stage: z
    .enum(SESSION_STAGES)
    .describe('The stage these documents belong to.'),
  files: z
    .array(
      z.object({
        filename: z
          .string()
          .describe(
            'The filename the skill generated, e.g. "toh345_stage1.docx". Not a path.',
          ),
        role: z
          .enum(['primary', 'supporting'])
          .default('supporting')
          .describe(
            "Whether this is the stage's deliverable or a companion record.",
          ),
      }),
    )
    .min(1)
    .describe('The documents being saved. One upload URL is issued per file.'),
  model: z
    .object({
      name: z.string(),
      version: z.string().optional(),
    })
    .optional()
    .describe(
      'The model producing this run. Record what you know; do not guess a version, and do not withhold the save over it.',
    ),
};

/**
 * Write tool for a session's working documents. Requires `harness.edit`.
 *
 * It does not carry the bytes. A `.docx` cannot ride in a JSON argument, and
 * base64 would push hundreds of kilobytes through the model's context, so the
 * tool authorizes the writes and the client PUTs each file itself.
 *
 * The manifest is written here rather than uploaded, so that the identity,
 * timestamp and work on it come from the verified token, the server clock and
 * the catalogue instead of from the agent.
 */
export function createWriteSessionDocumentsTool(
  client: DataClient,
  userId: string,
): McpToolDefinition {
  return {
    name: 'write-session-documents',
    description:
      'Save a translation session\'s working documents to storage. This authorizes the writes and returns one upload URL per file, each valid for two hours — PUT the file\'s bytes to its url with the content type given, e.g. `curl -X PUT -H "Content-Type: <contentType>" --data-binary @<file> "<uploadUrl>"`. Any revision being replaced is archived first. A manifest recording the work, who saved the set, when, and with what model is written for you.',
    inputSchema,
    annotations: {
      title: 'Write Session Documents',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    handler: async (args) => {
      const {
        toh: requestedToh,
        stage,
        model,
      } = args as {
        toh: string;
        stage: SessionStage;
        model?: { name: string; version?: string };
      };
      const files = args.files as WriteFileInput[];

      const allowed = await hasPermission({
        client,
        permission: 'harness.edit',
      });
      if (!allowed) {
        return errorResult(
          'This tool requires the harness.edit permission on the current account.',
        );
      }

      const toh = sessionToh(requestedToh);
      if (!toh) {
        return errorResult(
          `"${requestedToh}" is not a Tohoku number, so it names no session folder.`,
        );
      }

      const filenames = files.map((f) => f.filename);
      const invalid = invalidSessionFilenames(filenames);
      if (invalid.length) {
        return errorResult(
          `These are not valid document names: ${invalid.join(', ')}. A filename is a plain name, not a path.`,
        );
      }

      const reserved = reservedWriteNames(filenames);
      if (reserved.length) {
        return errorResult(
          `${reserved.join(', ')} is written for you and cannot be uploaded; pass the run's details instead.`,
        );
      }

      const duplicates = filenames.filter(
        (name, i) => filenames.indexOf(name) !== i,
      );
      if (duplicates.length) {
        return errorResult(
          `Each file may be listed once; ${[...new Set(duplicates)].join(', ')} appears more than once.`,
        );
      }

      const uploaded = await prepareSessionUploads({
        client,
        paths: filenames.map((filename) =>
          sessionPath({ toh, stage, filename }),
        ),
      });
      if (!uploaded.uploads) {
        return errorResult(
          uploaded.error ?? 'Could not authorize the uploads.',
        );
      }

      // Content types come back off the uploads, so the manifest records
      // exactly what the client was told to send.
      const roles = new Map(files.map((f) => [f.filename, f.role]));
      const manifestFiles: ManifestFile[] = uploaded.uploads.map((upload) => ({
        filename: upload.filename,
        contentType: upload.contentType,
        role: roles.get(upload.filename) ?? 'supporting',
      }));

      // The work uuid follows from the toh, so it is resolved here rather than
      // trusted from the agent. A number that resolves to nothing, or to more
      // than one work, records no uuid: the ambiguity is real and guessing at it
      // would be worse than omitting it. Never a reason to refuse the save.
      const resolutions = await resolveToh({ client, toh });
      const workUuid =
        resolutions.length === 1 ? resolutions[0].workUuid : undefined;

      const manifest = await writeSessionManifest({
        client,
        toh,
        workUuid,
        stage,
        files: manifestFiles,
        model,
        userUuid: userId,
      });
      if (!manifest.path) {
        return errorResult(manifest.error ?? 'Could not write the manifest.');
      }

      return jsonResult({
        toh,
        stage,
        uploads: uploaded.uploads,
        manifestPath: manifest.path,
      });
    },
  };
}
