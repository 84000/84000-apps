/**
 * The layers and presets the studio serves. Register a new layer here.
 */

import { etextsCatalogLayer, etextsTextLayer } from './etexts';
import { createLayerRegistry } from './registry';
import type { SnapshotLayer, SnapshotPreset } from './types';
import { workDraftLayer } from './work-draft';

export const SNAPSHOT_LAYERS: readonly SnapshotLayer[] = [
  workDraftLayer,
  etextsCatalogLayer,
  etextsTextLayer,
] as SnapshotLayer[];

/** The `dataset` forms of `download-snapshot`, served as before. */
export const SNAPSHOT_PRESETS: readonly SnapshotPreset[] = [
  {
    name: 'work',
    description: "One work's draft.",
    layers: [{ layer: 'work.draft', work: '{work}' }],
  },
  {
    name: 'etexts-catalog',
    description: 'The eText catalog of every collection.',
    layers: [{ layer: 'etexts.catalog' }],
  },
  {
    name: 'etexts-text',
    description: "One eText collection's full text.",
    layers: [{ layer: 'etexts.text', collection: '{collection}' }],
  },
];

export const snapshotLayerRegistry = createLayerRegistry({
  layers: SNAPSHOT_LAYERS,
  presets: SNAPSHOT_PRESETS,
});
