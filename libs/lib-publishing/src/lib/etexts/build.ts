/**
 * Builds an eText snapshot: a catalog archive and one text archive per collection,
 * written to a sink under a new build id. Nothing is overwritten; pointing
 * `latest.json` at the build is a separate step.
 */

import { createHash } from 'node:crypto';
import { tarGzTree } from '../snapshot/archive';
import {
  ETEXTS_FORMAT_VERSION,
  ETEXTS_ROOT,
  catalogObjectPath,
  collectionKey,
  etextsBuildId,
  manifestObjectPath,
  textObjectPath,
  volumeTextPath,
  type EtextsArchive,
  type EtextsBuildManifest,
} from './layout';
import type { EtextsReader } from './read';
import { renderCatalog, renderVolumeText, sortCollections } from './render';

/** Where a build's objects go: storage, or a local directory. */
export interface EtextsSink {
  put(path: string, body: Buffer, contentType: string): Promise<void>;
}

const archiveOf = (
  path: string,
  filename: string,
  tree: ReadonlyMap<string, string>,
  body: Buffer,
): EtextsArchive => ({
  path,
  filename,
  bytes: body.length,
  sha256: createHash('sha256').update(body).digest('hex'),
  files: tree.size,
  unpackedBytes: [...tree.values()].reduce(
    (sum, text) => sum + Buffer.byteLength(text, 'utf8'),
    0,
  ),
});

/**
 * Reads everything, writes the build's archives and manifest to `sink`, and returns the
 * manifest. `collections` limits the text archives to those keys; the catalog always
 * covers every collection.
 */
export const buildEtextsSnapshot = async ({
  reader,
  sink,
  collections: only,
  now = () => new Date(),
  log = () => undefined,
}: {
  reader: EtextsReader;
  sink: EtextsSink;
  collections?: readonly string[];
  now?: () => Date;
  log?: (message: string) => void;
}): Promise<EtextsBuildManifest> => {
  const started = now();
  const buildId = etextsBuildId(started);
  const mtime = Math.floor(started.getTime() / 1000);

  log(`Build ${buildId}: reading the catalog`);
  const rows = await reader.catalog();
  const collections = sortCollections(rows.collections);
  const keys = new Set(
    collections.map((c) => collectionKey(c.canon, c.rkts_id)),
  );
  const unknown = (only ?? []).filter((key) => !keys.has(key));
  if (unknown.length) {
    throw new Error(
      `No such collection: ${unknown.join(', ')}. Known: ${[...keys].join(', ')}`,
    );
  }

  const manifest: EtextsBuildManifest = {
    formatVersion: ETEXTS_FORMAT_VERSION,
    buildId,
    builtAt: started.toISOString(),
    latestOcrJob: rows.latestOcrJob,
    counts: {
      collections: rows.collections.length,
      volumes: rows.volumes.length,
      works: rows.works.length,
      conceptualWorks: rows.conceptualWorks.length,
      tohNumbers: rows.toh.length,
      referenceBoundaries: rows.referenceBoundaries.length,
      folios: 0,
    },
    text: {},
  };
  const folioCounts = new Map<string, number>();

  for (const collection of collections) {
    const key = collectionKey(collection.canon, collection.rkts_id);
    if (only && !only.includes(key)) continue;
    const volumes = rows.volumes
      .filter((v) => v.collection === collection.uuid)
      .sort((a, b) => a.vol_num - b.vol_num);
    const tree = new Map<string, string>();
    let folios = 0;
    for (const volume of volumes) {
      const sides = await reader.folios(volume.uuid);
      folioCounts.set(volume.uuid, sides.length);
      folios += sides.length;
      if (sides.length) {
        tree.set(volumeTextPath(key, volume.vol_num), renderVolumeText(sides));
      }
    }
    const body = tarGzTree({ tree, root: ETEXTS_ROOT, mtime });
    const path = textObjectPath(buildId, key);
    const filename = `etexts-${key.replace('/', '-')}-${buildId}.tar.gz`;
    await sink.put(path, body, 'application/gzip');
    manifest.text[key] = {
      ...archiveOf(path, filename, tree, body),
      key,
      title: collection.title_en ?? key,
      volumes: tree.size,
      folios,
    };
    manifest.counts.folios += folios;
    log(
      `${key}: ${tree.size}/${volumes.length} volumes, ${folios} folio sides, ${body.length} bytes`,
    );
  }

  const tree = renderCatalog({ rows, folioCounts, manifest });
  const body = tarGzTree({ tree, root: ETEXTS_ROOT, mtime });
  const path = catalogObjectPath(buildId);
  await sink.put(path, body, 'application/gzip');
  manifest.catalog = archiveOf(
    path,
    `etexts-catalog-${buildId}.tar.gz`,
    tree,
    body,
  );
  log(`catalog: ${tree.size} files, ${body.length} bytes`);

  await sink.put(
    manifestObjectPath(buildId),
    Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8'),
    'application/json',
  );
  return manifest;
};
