/**
 * `etexts.catalog` and `etexts.text`: the published eText build's archives. Prebuilt:
 * the bundle signs the stored archives, which unpack together under `etexts/`.
 */

import { z } from 'zod';
import {
  ETEXTS_BUCKET,
  ETEXTS_ROOT,
  type EtextsArchive,
} from '../etexts/layout';
import { readPublishedEtextsBuild } from '../etexts/storage';
import type { LayerContext, LayerResolution, SnapshotLayer } from './types';

const publishedBuild = ({ client, memo }: LayerContext) =>
  memo('etexts:published', () => readPublishedEtextsBuild(client));

const prebuilt = (
  buildId: string,
  archive: EtextsArchive,
): LayerResolution => ({
  status: 'ready',
  kind: 'prebuilt',
  dir: ETEXTS_ROOT,
  dataVersion: buildId,
  estimatedBytes: archive.bytes,
  archive: {
    bucket: ETEXTS_BUCKET,
    path: archive.path,
    filename: archive.filename,
    bytes: archive.bytes,
    sha256: archive.sha256,
  },
});

const unpublished = (status: 'none' | 'unavailable'): LayerResolution =>
  status === 'none'
    ? { status: 'not-found', error: 'No eText build is published yet.' }
    : {
        status: 'error',
        error: 'The eText build could not be read. Try again shortly.',
      };

const catalogOptions = z.strictObject({});

export const etextsCatalogLayer: SnapshotLayer<typeof catalogOptions> = {
  name: 'etexts.catalog',
  description:
    'Every Kangyur, Tengyur and Nyingma Gyubum witness in the eText collections: collections, volumes, works with titles, Toh numbers and folio ranges, and hand-checked Degé boundaries, as TSV tables.',
  permission: 'editor.read',
  scope: 'canon',
  options: catalogOptions,
  sources: ['published'],
  typicalSize: '2 MB',
  prebuilt: true,
  resolve: async (context) => {
    const published = await publishedBuild(context);
    if (published.status !== 'published') return unpublished(published.status);
    const { manifest } = published;
    if (!manifest.catalog) {
      return {
        status: 'error',
        error: 'The published eText build has no catalog.',
      };
    }
    return prebuilt(manifest.buildId, manifest.catalog);
  },
  readme: () =>
    'The eText catalog under `etexts/`. Read `etexts/README.md` first: it describes the tables, the conventions and how far each boundary can be trusted.',
};

const textOptions = z.strictObject({
  collection: z
    .string()
    .trim()
    .min(1)
    .describe('A collection key from the catalog, e.g. "kangyur/S"'),
});

export const etextsTextLayer: SnapshotLayer<typeof textOptions> = {
  name: 'etexts.text',
  description:
    "One eText collection's full text, one file per volume, each line prefixed with its folio side. Pair it with `etexts.catalog` to find a work's folios.",
  permission: 'editor.read',
  scope: 'canon',
  options: textOptions,
  sources: ['published'],
  typicalSize: '7 MB to 72 MB',
  prebuilt: true,
  resolve: async (context, { collection }) => {
    const published = await publishedBuild(context);
    if (published.status !== 'published') return unpublished(published.status);
    const { manifest } = published;
    const archive = manifest.text[collection];
    if (!archive) {
      return {
        status: 'not-found',
        error: `No eText collection "${collection}" in the published build. Collections: ${Object.keys(manifest.text).join(', ')}.`,
      };
    }
    return prebuilt(manifest.buildId, archive);
  },
  readme: ({ collection }) =>
    `The text of \`${collection}\` under \`etexts/text/${collection}/\`, one file per volume. \`etexts/README.md\` (in the catalog layer) describes the format.`,
};
