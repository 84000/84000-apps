/**
 * Names of the MCP tools the policy editor calls. A mirror of lib-agent's
 * `POLICY_TOOL_NAMES`: the bundle must not import `@eightyfourthousand/lib-agent`,
 * which pulls in server code. `tool-names.spec.ts` keeps the two equal.
 */
export const POLICY_TOOL_NAMES = {
  read: 'read-policies',
  write: 'write-policy',
  history: 'policy-history',
  readRevision: 'read-policy-revision',
  restore: 'restore-policy',
  delete: 'delete-policy',
  rename: 'rename-policy',
  openEditor: 'open-policy-editor',
} as const;
