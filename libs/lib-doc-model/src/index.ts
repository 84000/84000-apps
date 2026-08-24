/**
 * `@eightyfourthousand/lib-doc-model`
 *
 * Transformation between `passages` rows and TipTap editor content, in both
 * directions: `block.ts` and `transformers/` one way, `exporters/` and
 * `passageFromNode` the other, plus the passage labels both sides renumber.
 *
 * They live here rather than in `lib-editing` because more than the browser
 * editor needs them. The per-passage document model and the server-side
 * passage write path apply the same transformation from a Next.js route
 * handler, and `lib-editing` is a React component library. So nothing in this
 * package touches a browser API or imports an editor — see
 * `eslint.config.mjs`, which enforces the first half of that.
 *
 * `transformers/` is deliberately not exported: it was internal to
 * `lib-editing` and stays internal here. Only `blockFromPassage` and
 * `blocksFromTranslationBody` are public, and `lib-editing` re-exports those
 * two so its own consumers are unaffected.
 */

export { blockFromPassage, blocksFromTranslationBody } from './lib/block';

export { decrementLabel, incrementLabel } from './lib/labels';

export { passageFromNode } from './lib/passage';

export { MARK_TYPES } from './lib/mark-types';
export type { SpanMarkType } from './lib/mark-types';

export * from './lib/exporters';
