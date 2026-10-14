/**
 * Snapshot anchors live in lib-utils, so that every surface that cites a passage,
 * term or bibliography entry by anchor (the snapshot, and the glossary resolver's
 * candidates) computes the same anchor for the same uuid set.
 */
export {
  anchorOfLine,
  makeAnchors,
  MIN_ANCHOR_HEX,
} from '@eightyfourthousand/lib-utils';
