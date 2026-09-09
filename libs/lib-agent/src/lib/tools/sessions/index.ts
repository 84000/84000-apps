import type { DataClient } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';

import { createReadSessionDocumentsTool } from './read-session-documents';
import { createWriteSessionDocumentsTool } from './write-session-documents';

/**
 * Session document tools, kept apart from the read and write tool sets for the
 * same reason as the policy tools: the studio route lists write tools for
 * editors only, while these reach translators, who are their primary audience.
 * Each handler checks its own `harness.*` permission, which is the
 * authoritative gate.
 *
 * `userId` comes from the verified token and is what the manifest records; it
 * is never taken from the agent.
 */
export function createSessionTools(
  client: DataClient,
  userId: string,
): McpToolDefinition[] {
  return [
    createReadSessionDocumentsTool(client),
    createWriteSessionDocumentsTool(client, userId),
  ];
}

export { createReadSessionDocumentsTool } from './read-session-documents';
export { createWriteSessionDocumentsTool } from './write-session-documents';
