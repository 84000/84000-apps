/**
 * `etexts.catalog` and `etexts.text`: the published eText build's archives. Prebuilt:
 * the bundle signs the stored archives, which unpack together under `etexts/`. One
 * witness or folio range of a collection is generated instead, under
 * `etexts-witnesses/`.
 */

import { z } from 'zod';
import {
  ETEXTS_BUCKET,
  ETEXTS_ROOT,
  type EtextsArchive,
} from '../etexts/layout';
import { readPublishedEtextsBuild } from '../etexts/storage';
import {
  createWitnessReader,
  planWitness,
  renderWitnessFiles,
  type WitnessReader,
  type WitnessSelector,
  type WitnessSpan,
} from '../etexts/witness';
import { parseFolioLabel } from '../folio';
import { normalizeWorkKey } from './registry';
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

const folioOption = (what: string) =>
  z
    .string()
    .trim()
    .refine((label) => parseFolioLabel(label) !== null, {
      message: 'Write folios as F.<number>.<side>, e.g. "F.12.a".',
    })
    .optional()
    .describe(what);

const textOptions = z
  .strictObject({
    collection: z
      .string()
      .trim()
      .min(1)
      .describe('A collection key from the catalog, e.g. "kangyur/S"'),
    toh: z
      .string()
      .trim()
      .min(1)
      .transform(normalizeWorkKey)
      .refine((key) => key.startsWith('toh'), {
        message: 'Pass a Toh number, e.g. "toh340" or "340".',
      })
      .optional()
      .describe(
        "Only this work's witness(es) in the collection, by Toh number. Without toh, witness or a range, the whole collection.",
      ),
    witness: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Only this witness, by its siglum number in the collection (`siglum_number` in works.tsv), e.g. "S274".',
      ),
    startVolume: z
      .int()
      .positive()
      .optional()
      .describe('An explicit range: the first volume.'),
    startFolio: folioOption('An explicit range: the first side, "F.1.b".'),
    endVolume: z
      .int()
      .positive()
      .optional()
      .describe('An explicit range: the last volume; defaults to startVolume.'),
    endFolio: folioOption('An explicit range: the last side, "F.20.a".'),
  })
  .superRefine((options, ctx) => {
    const range = [
      options.startVolume,
      options.startFolio,
      options.endVolume,
      options.endFolio,
    ].some((value) => value !== undefined);
    const chosen = [
      options.toh !== undefined,
      options.witness !== undefined,
      range,
    ].filter(Boolean).length;
    if (chosen > 1) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Pass one of toh, witness, or a range (startVolume, startFolio, endFolio, optional endVolume), not several.',
      });
    }
    if (
      range &&
      (options.startVolume === undefined ||
        options.startFolio === undefined ||
        options.endFolio === undefined)
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'A range needs startVolume, startFolio and endFolio (endVolume defaults to startVolume).',
      });
    }
  });

type TextOptions = z.output<typeof textOptions>;

/** What part of the collection the options name; null for all of it. */
const selectorOf = (options: TextOptions): WitnessSelector | null => {
  if (options.toh) return { toh: options.toh };
  if (options.witness) return { witness: options.witness };
  if (options.startVolume && options.startFolio && options.endFolio) {
    return {
      startVolume: options.startVolume,
      startFolio: options.startFolio,
      endVolume: options.endVolume ?? options.startVolume,
      endFolio: options.endFolio,
    };
  }
  return null;
};

/** Generated witness files sit beside, never inside, the prebuilt `etexts/` tree. */
export const ETEXTS_WITNESS_ROOT = 'etexts-witnesses';

const selectorDir = (selector: WitnessSelector): string =>
  'toh' in selector
    ? selector.toh
    : 'witness' in selector
      ? `witness-${selector.witness}`
      : `v${selector.startVolume}-${selector.startFolio}-v${selector.endVolume}-${selector.endFolio}`;

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** About the number of sides a span holds, for the size estimate. */
const estimateSides = (span: WitnessSpan, sidesPerVolume: number): number =>
  span.startVolume === span.endVolume
    ? (span.end.seq ?? 0) - (span.start.seq ?? 0) + 1
    : Math.max(0, sidesPerVolume - (span.start.seq ?? 0) + 1) +
      (span.volumes.length - 2) * sidesPerVolume +
      (span.end.seq ?? sidesPerVolume);

const resolveWitness = async (
  readerFor: (client: LayerContext['client']) => WitnessReader,
  context: LayerContext,
  options: TextOptions,
  selector: WitnessSelector,
): Promise<LayerResolution> => {
  const published = await publishedBuild(context);
  if (published.status !== 'published') return unpublished(published.status);
  const { manifest } = published;
  const { collection } = options;
  const archive = manifest.text[collection];
  if (!archive) {
    return {
      status: 'not-found',
      error: `No eText collection "${collection}" in the published build. Collections: ${Object.keys(manifest.text).join(', ')}.`,
    };
  }
  const dirName = selectorDir(selector);
  const dir = [ETEXTS_WITNESS_ROOT, ...collection.split('/'), dirName]
    .filter(Boolean)
    .join('/');
  if (
    !dir
      .split('/')
      .every((part) => SAFE_SEGMENT.test(part) && !/^\.+$/.test(part))
  ) {
    return {
      status: 'not-found',
      error: `"${collection}" or "${dirName}" is not a usable name.`,
    };
  }
  const reader = readerFor(context.client);
  let plan;
  try {
    plan = await planWitness({ reader, collectionKey: collection, selector });
  } catch (error) {
    console.error(`Resolving an etexts.text witness of ${collection}:`, error);
    return {
      status: 'error',
      error: 'The eText tables could not be read. Try again shortly.',
    };
  }
  if (plan.status !== 'ready') return plan;

  const sidesPerVolume = archive.volumes
    ? Math.ceil(archive.folios / archive.volumes)
    : 0;
  const bytesPerSide = archive.folios ? archive.bytes / archive.folios : 0;
  const sides = plan.spans.reduce(
    (sum, span) => sum + estimateSides(span, sidesPerVolume),
    0,
  );
  const ready = plan;
  return {
    status: 'ready',
    kind: 'generated',
    dir,
    dataVersion: `${manifest.buildId}:${plan.fingerprint}`,
    estimatedBytes: Math.min(
      archive.bytes,
      Math.ceil(sides * bytesPerSide) + 1024,
    ),
    ...(plan.skipped.length
      ? {
          note: `Skipped ${plan.skipped.length} witness${plan.skipped.length === 1 ? '' : 'es'} with no usable folio range; see witnesses.tsv.`,
        }
      : {}),
    generate: () => renderWitnessFiles(reader, ready),
  };
};

/** `etexts.text`, reading witnesses with `readerFor`: a seam for tests. */
export const createEtextsTextLayer = (
  readerFor: (
    client: LayerContext['client'],
  ) => WitnessReader = createWitnessReader,
): SnapshotLayer<typeof textOptions> => ({
  name: 'etexts.text',
  description:
    "One eText collection's text, each line prefixed with its folio side. By default the whole collection, one file per volume. With `toh`, `witness`, or a range (`startVolume`, `startFolio`, `endVolume`, `endFolio`), only those sides, from the start folio to the end folio across volumes, in the same line format. Pair it with `etexts.catalog` to find a work's witnesses and folios.",
  permission: 'editor.read',
  scope: 'canon',
  options: textOptions,
  sources: ['published'],
  typicalSize: '7 MB to 72 MB; one witness 10 KB to 2 MB',
  prebuilt: true,
  resolve: async (context, options) => {
    const selector = selectorOf(options);
    if (selector) return resolveWitness(readerFor, context, options, selector);
    const { collection } = options;
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
  readme: (options, resolved) => {
    const { collection } = options;
    if (!selectorOf(options)) {
      return `The text of \`${collection}\` under \`etexts/text/${collection}/\`, one file per volume. \`etexts/README.md\` (in the catalog layer) describes the format.`;
    }
    return [
      `Part of \`${collection}\`, under \`${resolved.dir}/\`: ${describeSelection(options)}.`,
      '',
      `Each witness has its own directory, named for its siglum number (\`range\` for an explicit range), holding one file per volume it crosses, named like the collection's own (\`012.txt\`). Lines are as in the full collection: one folio side per line, \`[F.12.a] …\`, and \`[F.?]\` for a side the source gives no folio number. A witness that crosses volumes runs from its start side to the end of the first volume, through every volume between, to its end side.`,
      '',
      '`witnesses.tsv` lists each witness: its titles, start and end volume and folio, `boundary_status` (how far to trust the range; `etexts/README.md` in the catalog layer explains the values), BDRC id, number of sides and files. Witnesses of the Toh with no usable range are listed as skipped.',
      '',
      '**The first and last sides may hold neighbouring texts.** A witness starts and ends on a whole folio side, which usually also holds the end of the previous text and the start of the next. The text itself opens at *rgya gar skad du* (རྒྱ་གར་སྐད་དུ) and closes at its colophon.',
      '',
      'Read from the eText tables, versioned with the published eText build; it matches that build unless the tables were reloaded after it.',
    ].join('\n');
  },
});

export const etextsTextLayer = createEtextsTextLayer();

const describeSelection = (options: TextOptions): string => {
  const selector = selectorOf(options);
  if (!selector) return 'the whole collection';
  if ('toh' in selector) return `every witness of ${selector.toh}`;
  if ('witness' in selector) return `witness ${selector.witness}`;
  return `volume ${selector.startVolume} ${selector.startFolio} to volume ${selector.endVolume} ${selector.endFolio}`;
};
