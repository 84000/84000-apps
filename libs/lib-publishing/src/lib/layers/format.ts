/**
 * Bundle-wide format options: they apply to every layer in a bundle.
 */

import { z } from 'zod';

/** How Tibetan is written in generated files. */
export const TIBETAN_FORMATS = ['unicode', 'ewts', 'both'] as const;
export type TibetanFormat = (typeof TIBETAN_FORMATS)[number];

/** The Tibetan formats generators can write today. */
export const SUPPORTED_TIBETAN_FORMATS: readonly TibetanFormat[] = ['unicode'];

export const bundleFormatSchema = z.strictObject({
  tibetan: z.enum(TIBETAN_FORMATS).default('unicode'),
});

export type BundleFormat = z.output<typeof bundleFormatSchema>;

/** One bundle-wide option, as discovery lists it. */
export interface BundleFormatOption {
  name: keyof BundleFormat;
  description: string;
  values: readonly string[];
  /** The values generators accept today; others are refused. */
  supported: readonly string[];
  default: string;
}

export const BUNDLE_FORMAT_OPTIONS: readonly BundleFormatOption[] = [
  {
    name: 'tibetan',
    description:
      'How generated files write Tibetan: Unicode, EWTS transliteration, or both. Prebuilt archives keep their own format.',
    values: TIBETAN_FORMATS,
    supported: SUPPORTED_TIBETAN_FORMATS,
    default: 'unicode',
  },
];

/** The validated format, or why it is refused. */
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
  const { tibetan } = parsed.data;
  if (!SUPPORTED_TIBETAN_FORMATS.includes(tibetan)) {
    return {
      ok: false,
      error: `format.tibetan "${tibetan}" is not available yet; use ${SUPPORTED_TIBETAN_FORMATS.map((v) => `"${v}"`).join(' or ')}.`,
    };
  }
  return { ok: true, format: parsed.data };
};
