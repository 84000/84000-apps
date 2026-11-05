import type { Extensions } from '@tiptap/core';

import { Mention } from '../editor/extensions/Mention/Mention';
import { MentionSSR } from '../editor/extensions/Mention/Mention.ssr';

/**
 * A schema set with its mention node swapped for the editor's, which adds the
 * suggestion, drop and spacing plugins and the node view. The node itself is
 * the same, so documents parse alike either way.
 */
export const withMentionAuthoring = (schema: Extensions): Extensions =>
  schema.map((extension) => (extension === MentionSSR ? Mention : extension));
