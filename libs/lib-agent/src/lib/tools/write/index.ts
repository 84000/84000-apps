import type { DataClient } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';

import { createApplyDocxImportTool } from './apply-docx-import';

/**
 * Write tools mutate studio data. Each handler performs its own permission
 * check (via `requirePermission`) before mutating, so this is defense in depth
 * on top of any role gating applied where the tools are registered.
 */
export function createWriteTools(client: DataClient): McpToolDefinition[] {
  return [createApplyDocxImportTool(client)];
}

export { createApplyDocxImportTool } from './apply-docx-import';
