/**
 * Next-free entry point for editing translation policies: the `PolicySource`
 * contract, the policy editor, and the markdown editor beneath it. Bundles
 * without `next`, `next-themes`, client-graphql or Yjs (see
 * `policy-editor.spec.ts`), so modules exported here import only by file path
 * or from `@eightyfourthousand/design-system/core` and
 * `@eightyfourthousand/lib-utils`, never from a barrel.
 */
export * from './lib/components/policy-editor/policy-source';
export * from './lib/components/policy-editor/memory-policy-source';
export {
  MarkdownEditor,
  type MarkdownEditorMode,
  type MarkdownEditorProps,
} from './lib/components/editor/markdown/MarkdownEditor';
export {
  checkMarkdownRoundTrip,
  hasMarkdownChanges,
  type MarkdownFallbackReason,
  type MarkdownRoundTrip,
} from './lib/components/editor/markdown/markdown-codec';
export type { EditorMenuSlot } from './lib/components/editor/EditorCore';
