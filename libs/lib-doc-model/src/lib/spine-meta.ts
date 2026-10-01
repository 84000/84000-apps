import { Map as YMap } from 'yjs';
import { panelAndTabForContentType } from '@eightyfourthousand/data-access';
import type { PassageMeta } from './types';

/**
 * Whether a mutation should renumber the labels it disturbs.
 *
 * Ordinary edits do. Command-log replay does not: it restores the exact labels
 * the original operation produced, and letting the spine renumber underneath
 * that would compute them a second time from a different starting state.
 */
export type MutateOptions = {
  renumber?: boolean;
  /**
   * The passage leaves the work, not just what is loaded, so a save must
   * delete it. Unloading a window to follow a deep link removes passages too.
   */
  deleted?: boolean;
};

/**
 * What a caller supplies for a new passage.
 *
 * Placement is not part of it: panel and tab are derived from the type by
 * `panelAndTabForContentType`, so there is no way to seed a passage into a tab
 * its type does not belong to.
 */
export type SpineSeed = Omit<PassageMeta, 'panel' | 'tab'>;

/** Yjs key for the ordered passage uuids. */
export const ORDER_KEY = 'order';
/** Yjs key for the uuid → metadata map. */
export const METAS_KEY = 'metas';

/** A passage's metadata as the spine stores it. */
export const metaMap = (passage: SpineSeed): YMap<unknown> => {
  const { panel, tab } = panelAndTabForContentType(passage.type);
  const entry = new YMap<unknown>();
  entry.set('label', passage.label);
  entry.set('type', passage.type);
  entry.set('panel', panel);
  entry.set('tab', tab);
  if (passage.toh) entry.set('toh', passage.toh);
  if (passage.sort !== undefined) entry.set('sort', passage.sort);
  return entry;
};
