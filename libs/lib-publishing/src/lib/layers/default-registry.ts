/**
 * The layers and presets the studio serves. Register a new layer here.
 */

import { etextsCatalogLayer, etextsTextLayer } from './etexts';
import { createLayerRegistry } from './registry';
import type { SnapshotLayer, SnapshotPreset } from './types';
import { workDraftLayer } from './work-draft';
import { workFoliosLayer } from './work-folios';
import { createWorkLayers, WORK_LAYER_NAMES } from './work-layers';

export const SNAPSHOT_LAYERS: readonly SnapshotLayer[] = [
  workDraftLayer,
  workFoliosLayer,
  ...createWorkLayers(),
  etextsCatalogLayer,
  etextsTextLayer,
] as SnapshotLayer[];

/** The `dataset` forms of `download-snapshot`, served as before. */
export const SNAPSHOT_PRESETS: readonly SnapshotPreset[] = [
  {
    name: 'work',
    description:
      "One work's draft: its passages, raw passages, annotations, glossary and bibliography, the files `work-ls`, `work-read` and `work-grep` read.",
    layers: WORK_LAYER_NAMES.map((layer) => ({
      layer,
      work: '{work}',
      source: 'draft',
    })),
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
