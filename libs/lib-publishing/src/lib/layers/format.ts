/**
 * Bundle-wide format options: one value per bundle, honoured layer by layer.
 *
 * Each layer says which `format.tibetan` values it writes (`tibetanFormats`). A
 * generated layer asked for a value it does not write refuses the bundle; a prebuilt
 * archive keeps the format it was built in, whatever is asked, and the README and
 * manifest say so.
 */

import { z } from 'zod';
import type { SnapshotLayer } from './types';

/** How Tibetan is written in generated files. */
export const TIBETAN_FORMATS = ['unicode', 'ewts', 'both'] as const;
export type TibetanFormat = (typeof TIBETAN_FORMATS)[number];

/** What a layer writes when it does not say: Unicode only. */
export const DEFAULT_TIBETAN_FORMATS: readonly TibetanFormat[] = ['unicode'];

export const bundleFormatSchema = z.strictObject({
  tibetan: z.enum(TIBETAN_FORMATS).default('unicode'),
});

export type BundleFormat = z.output<typeof bundleFormatSchema>;

/** The `format.tibetan` values a layer writes. */
export const layerTibetanFormats = (
  layer: Pick<SnapshotLayer, 'tibetanFormats'>,
): readonly TibetanFormat[] => layer.tibetanFormats ?? DEFAULT_TIBETAN_FORMATS;

/**
 * The Tibetan format a layer's files are actually in, given the bundle's: the
 * requested one for a generated layer, the archive's own for a prebuilt one.
 */
export const writtenTibetanFormat = (
  layer: Pick<SnapshotLayer, 'tibetanFormats' | 'prebuilt'>,
  format: BundleFormat,
): TibetanFormat =>
  layer.prebuilt ? layerTibetanFormats(layer)[0] : format.tibetan;

/** One bundle-wide option, as discovery lists it. */
export interface BundleFormatOption {
  name: keyof BundleFormat;
  description: string;
  values: readonly string[];
  /** The values at least one layer writes; any other is refused. */
  supported: readonly string[];
  default: string;
}

const quoted = (values: readonly string[]) =>
  values.map((v) => `\`${v}\``).join(', ');

/**
 * The bundle-wide options for `layers`, with which layers honour each value, so
 * discovery never offers a value no layer writes.
 */
export const bundleFormatOptions = (
  layers: readonly Pick<
    SnapshotLayer,
    'name' | 'prebuilt' | 'tibetanFormats'
  >[],
): BundleFormatOption[] => {
  const generated = layers.filter((l) => !l.prebuilt);
  const supported = TIBETAN_FORMATS.filter(
    (value) =>
      value === 'unicode' ||
      generated.some((l) => layerTibetanFormats(l).includes(value)),
  );
  const writers = (value: TibetanFormat) =>
    generated
      .filter((l) => layerTibetanFormats(l).includes(value))
      .map((l) => l.name);
  const perValue = supported
    .filter((value) => value !== 'unicode')
    .map((value) => `\`${value}\` is written by ${quoted(writers(value))}`);
  const unicodeOnly = generated
    .filter((l) => !layerTibetanFormats(l).some((v) => v !== 'unicode'))
    .map((l) => l.name);
  const prebuilt = layers.filter((l) => l.prebuilt).map((l) => l.name);
  const sentences = [
    '`unicode` writes Tibetan script; `ewts` writes Extended Wylie (house profile, as the `transliterate` tool returns it) in place of the script; `both` writes each file in both, the EWTS copy under an `ewts/` subdirectory with the same file names and lines.',
    perValue.length ? `${perValue.join('; ')}.` : '',
    unicodeOnly.length
      ? `Generated layers that write only \`unicode\` (${quoted(unicodeOnly)}) refuse any other value: request them in a separate bundle.`
      : '',
    prebuilt.length
      ? `Prebuilt archives (${quoted(prebuilt)}) keep their own format (Unicode) whatever is asked; the README and manifest.json say which format each layer is in.`
      : '',
  ];
  return [
    {
      name: 'tibetan',
      description: [
        'How generated files write Tibetan.',
        ...sentences.filter(Boolean),
      ].join(' '),
      values: TIBETAN_FORMATS,
      supported,
      default: 'unicode',
    },
  ];
};

/** The validated format, or why it is invalid. Layers then check what they write. */
export const parseBundleFormat = (
  raw: unknown,
): { ok: true; format: BundleFormat } | { ok: false; error: string } => {
  const parsed = bundleFormatSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid format: ${z.prettifyError(parsed.error)}`,
    };
  }
  return { ok: true, format: parsed.data };
};

/**
 * Why `format` cannot be honoured by the generated layers among `layers`, or null.
 * Prebuilt layers never refuse: they keep their own format.
 */
export const unsupportedFormatError = (
  layers: readonly Pick<
    SnapshotLayer,
    'name' | 'prebuilt' | 'tibetanFormats'
  >[],
  format: BundleFormat,
): string | null => {
  const refusing = [
    ...new Map(
      layers
        .filter(
          (l) =>
            !l.prebuilt && !layerTibetanFormats(l).includes(format.tibetan),
        )
        .map((l) => [l.name, l]),
    ).values(),
  ];
  if (!refusing.length) return null;
  const one = refusing.length === 1;
  return `format.tibetan "${format.tibetan}" is not available for ${refusing
    .map((l) => `${l.name} (writes ${quoted(layerTibetanFormats(l))})`)
    .join(
      ', ',
    )}. Request ${one ? 'it' : 'them'} in a separate bundle with a format ${one ? 'it writes' : 'they write'}, or use "unicode" for the whole bundle.`;
};
