import type { McpToolDefinition } from '../../types';
import { errorResult, textResult } from '../read/util';
import type {
  SnapshotBundleSource,
  SnapshotFormatEntry,
  SnapshotLayerEntry,
  SnapshotPresetEntry,
} from './bundle-source';

const BYTES_PER_MB = 1024 * 1024;

const HEADER = [
  'Layers `download-snapshot` can bundle. Pass `layers` as a list of `{ "layer": "<name>", ...options }`, and optionally `format`. One bundle unpacks into one directory with a README covering every layer.',
  'A layer you are not granted is refused, and nothing is built.',
].join('\n');

/** A JSON value as written in a layer's options: strings bare, the rest as JSON. */
const valueText = (value: unknown) =>
  typeof value === 'string' ? value : JSON.stringify(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The type of a JSON Schema property: `type`, else the types of its alternatives. */
const schemaType = (schema: Record<string, unknown>): string => {
  const { type } = schema;
  if (typeof type === 'string') {
    if (type !== 'array' || !isRecord(schema.items)) return type;
    const item = schemaType(schema.items);
    return item ? `array of ${item}` : type;
  }
  if (Array.isArray(type)) return type.filter(Boolean).join('|');
  const alternatives = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(alternatives)) {
    return [
      ...new Set(alternatives.filter(isRecord).map(schemaType).filter(Boolean)),
    ].join('|');
  }
  return '';
};

/** One option of a layer, from its JSON Schema property. */
const optionLine = (
  name: string,
  property: unknown,
  required: boolean,
): string => {
  const schema = isRecord(property) ? property : {};
  const parts = [schemaType(schema)];
  if (Array.isArray(schema.enum)) {
    parts.push(`enum ${schema.enum.map(valueText).join('|')}`);
  } else if ('const' in schema) {
    parts.push(`const ${valueText(schema.const)}`);
  }
  if ('default' in schema) parts.push(`default ${valueText(schema.default)}`);
  parts.push(required ? 'required' : 'optional');
  const description =
    typeof schema.description === 'string' ? `: ${schema.description}` : '';
  return `    ${name} (${parts.filter(Boolean).join(', ')})${description}`;
};

/** The lines for a layer's options, from the JSON Schema the server gives. */
const optionLines = (options: unknown): string[] => {
  const schema = isRecord(options) ? options : {};
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = new Set(
    Array.isArray(schema.required) ? schema.required : [],
  );
  const names = Object.keys(properties).filter((name) => name !== 'layer');
  if (names.length === 0) return ['  options: none'];
  return [
    '  options:',
    ...names.map((name) =>
      optionLine(name, properties[name], required.has(name)),
    ),
  ];
};

const scopeText = (scope: string) =>
  scope === 'work' ? 'per work' : scope === 'canon' ? 'canon-wide' : scope;

const layerLines = (layer: SnapshotLayerEntry): string[] => [
  `${layer.name} — ${layer.permission} (${layer.granted ? 'granted' : 'not granted'}) · ${scopeText(layer.scope)} · ${layer.prebuilt ? 'prebuilt' : 'generated'} · typically ${layer.typicalSize}`,
  `  ${layer.description}`,
  ...optionLines(layer.options),
];

const presetLine = (preset: SnapshotPresetEntry) =>
  `- ${preset.name}: ${preset.description} — ${JSON.stringify(preset.layers)}`;

const formatLine = (format: SnapshotFormatEntry) =>
  `- ${format.name}: ${format.values.join(' | ')}, default ${format.default}, available now: ${format.supported.join(', ')} — ${format.description}`;

/**
 * `list-snapshot-layers`: what `download-snapshot` can bundle, as the server
 * lists it. Nothing here names a layer, so a layer added on the server shows up
 * without a change to this tool.
 */
export function createListSnapshotLayersTool(
  bundles: SnapshotBundleSource,
): McpToolDefinition {
  return {
    name: 'list-snapshot-layers',
    description:
      "Lists the layers `download-snapshot` can bundle (a work's draft, the eText catalog and text, and more as they are added): what each holds, the options it takes, whether you may have it, its typical size, and the presets and formats. Call it before building a `layers` request.",
    inputSchema: {},
    annotations: {
      title: 'List Snapshot Layers',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async () => {
      const catalog = await bundles.layers();
      if (catalog.status === 'error') return errorResult(catalog.error);
      const limitMb = Number(
        (catalog.maxBundleBytes / BYTES_PER_MB).toFixed(1),
      );
      const sections = [
        HEADER,
        catalog.layers
          .map((layer) => layerLines(layer).join('\n'))
          .join('\n\n'),
      ];
      if (catalog.presets.length) {
        sections.push(
          [
            'Presets, the `dataset` forms as layers (a "{param}" value takes the call field of that name):',
            ...catalog.presets.map(presetLine),
          ].join('\n'),
        );
      }
      if (catalog.formats.length) {
        sections.push(
          [
            'Bundle-wide formats (`format`):',
            ...catalog.formats.map(formatLine),
          ].join('\n'),
        );
      }
      sections.push(
        `A bundle may download up to ${limitMb.toLocaleString('en-US')} MB (compressed).`,
      );
      return textResult(sections.filter(Boolean).join('\n\n'));
    },
  };
}
