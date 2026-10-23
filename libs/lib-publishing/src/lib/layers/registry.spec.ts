import { z } from 'zod';
import { snapshotLayerRegistry } from './default-registry';
import {
  bundleFormatOptions,
  parseBundleFormat,
  unsupportedFormatError,
} from './format';
import {
  canonicalJson,
  createLayerRegistry,
  describeLayers,
  MAX_LAYERS_PER_BUNDLE,
  normalizeWorkKey,
  parseLayerRequests,
  refusedLayers,
  requiredPermission,
  sourceOption,
  workOption,
} from './registry';
import type { LayerPermission, SnapshotLayer } from './types';

const layer = (
  name: string,
  permission: LayerPermission = 'editor.read',
  options: z.ZodObject = z.strictObject({}),
): SnapshotLayer => ({
  name,
  description: name,
  permission,
  scope: 'canon',
  options,
  sources: ['published'],
  typicalSize: '1 KB',
  prebuilt: false,
  resolve: async () => ({ status: 'not-found', error: 'unused' }),
  readme: () => '',
});

const registry = createLayerRegistry({
  layers: [
    layer('work.notes', 'editor.edit', z.strictObject({ work: workOption() })),
    layer(
      'work.passages',
      'editor.read',
      z.strictObject({ work: workOption(), source: sourceOption('draft') }),
    ),
    layer('etexts.catalog'),
  ],
});

describe('createLayerRegistry', () => {
  it('lists layers by name and finds them', () => {
    expect(registry.layers.map((l) => l.name)).toEqual([
      'etexts.catalog',
      'work.notes',
      'work.passages',
    ]);
    expect(registry.get('work.notes')?.permission).toBe('editor.edit');
    expect(registry.get('work.nope')).toBeUndefined();
  });

  it('refuses undotted, duplicate and preset-unknown names', () => {
    expect(() => createLayerRegistry({ layers: [layer('notes')] })).toThrow(
      /dotted/,
    );
    expect(() =>
      createLayerRegistry({ layers: [layer('a.b'), layer('a.b')] }),
    ).toThrow(/twice/);
    expect(() =>
      createLayerRegistry({
        layers: [layer('a.b')],
        presets: [{ name: 'p', description: '', layers: [{ layer: 'a.c' }] }],
      }),
    ).toThrow(/unknown layer "a.c"/);
  });

  it('registers the studio layers and their presets', () => {
    expect(snapshotLayerRegistry.layers.map((l) => l.name)).toEqual([
      'etexts.catalog',
      'etexts.text',
      'work.annotations',
      'work.bibliography',
      'work.draft',
      'work.folios',
      'work.glossary',
      'work.passages',
      'work.passages.raw',
    ]);
    expect(snapshotLayerRegistry.presets.map((p) => p.name)).toEqual([
      'work',
      'etexts-catalog',
      'etexts-text',
    ]);
  });
});

describe('parseLayerRequests', () => {
  it('parses options, fills defaults and normalizes works', () => {
    const parsed = parseLayerRequests(registry, [
      { layer: 'work.passages', work: 'Toh 8' },
      { layer: 'etexts.catalog' },
    ]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.requests.map((r) => [r.layer.name, r.options])).toEqual([
      ['work.passages', { work: 'toh8', source: 'draft' }],
      ['etexts.catalog', {}],
    ]);
  });

  it('collapses duplicate requests', () => {
    const parsed = parseLayerRequests(registry, [
      { layer: 'work.passages', work: 'toh8' },
      { layer: 'work.passages', work: '8', source: 'draft' },
    ]);
    expect(parsed.ok && parsed.requests).toHaveLength(1);
  });

  it('reports every problem at once', () => {
    const parsed = parseLayerRequests(registry, [
      { layer: 'work.nope' },
      { layer: 'work.notes' },
      { layer: 'etexts.catalog', source: 'draft' },
      'etexts.catalog',
    ]);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/^Unknown layer: work\.nope\. Known: /);
    expect(parsed.error).toMatch(/layers\[1\] \(work\.notes\).*work/);
    expect(parsed.error).toMatch(/layers\[2\] \(etexts\.catalog\).*source/);
    expect(parsed.error).toMatch(/layers\[3\]: expected/);
  });

  it('refuses an empty or oversized list', () => {
    expect(parseLayerRequests(registry, []).ok).toBe(false);
    expect(parseLayerRequests(registry, undefined).ok).toBe(false);
    const many = Array.from({ length: MAX_LAYERS_PER_BUNDLE + 1 }, () => ({
      layer: 'etexts.catalog',
    }));
    expect(parseLayerRequests(registry, many).ok).toBe(false);
  });
});

describe('refusedLayers', () => {
  const requests = (names: string[]) => {
    const parsed = parseLayerRequests(
      registry,
      names.map((layer) => ({ layer, work: 'toh8' })),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.requests;
  };

  it('names every layer whose permission is missing, checking each once', async () => {
    const asked: string[] = [];
    const refused = await refusedLayers(
      requests(['work.notes', 'work.passages']),
      async (permission) => {
        asked.push(permission);
        return permission === 'editor.read';
      },
    );
    expect(refused).toEqual(['work.notes']);
    expect(asked.sort()).toEqual(['editor.edit', 'editor.read']);
  });

  it('treats a failed check as refused', async () => {
    const refused = await refusedLayers(
      requests(['work.passages']),
      async () => {
        throw new Error('rpc down');
      },
    );
    expect(refused).toEqual(['work.passages']);
  });

  it('checks the permission a request needs, and none when it needs none', async () => {
    const gated = createLayerRegistry({
      layers: [
        {
          ...layer(
            'work.text',
            'editor.read',
            z.strictObject({
              work: workOption(),
              source: sourceOption('published'),
            }),
          ),
          permissionFor: ({ source }) =>
            source === 'draft' ? 'editor.read' : null,
        },
      ],
    });
    const parse = (source: string) => {
      const parsed = parseLayerRequests(gated, [
        { layer: 'work.text', work: 'toh8', source },
      ]);
      if (!parsed.ok) throw new Error(parsed.error);
      return parsed.requests;
    };
    const asked: string[] = [];
    const deny = async (permission: string) => {
      asked.push(permission);
      return false;
    };
    expect(requiredPermission(parse('draft')[0])).toBe('editor.read');
    expect(requiredPermission(parse('published')[0])).toBeNull();
    expect(await refusedLayers(parse('published'), deny)).toEqual([]);
    expect(asked).toEqual([]);
    expect(await refusedLayers(parse('draft'), deny)).toEqual(['work.text']);
    expect(asked).toEqual(['editor.read']);
  });

  it('refuses nothing when every permission is held', async () => {
    expect(
      await refusedLayers(
        requests(['work.notes', 'work.passages']),
        async () => true,
      ),
    ).toEqual([]);
  });
});

describe('describeLayers', () => {
  it('lists every layer with its options as JSON Schema', () => {
    const [, , passages] = describeLayers(registry);
    expect(passages).toMatchObject({
      name: 'work.passages',
      permission: 'editor.read',
      options: {
        type: 'object',
        properties: {
          work: { type: 'string' },
          source: { enum: ['draft', 'published'], default: 'draft' },
        },
        required: ['work'],
      },
    });
  });

  it('describes the studio layers', () => {
    expect(() => describeLayers(snapshotLayerRegistry)).not.toThrow();
  });
});

describe('helpers', () => {
  it('normalizes Toh keys and leaves uuids', () => {
    expect(normalizeWorkKey('8')).toBe('toh8');
    expect(normalizeWorkKey('Toh 1-14')).toBe('toh1-14');
    expect(normalizeWorkKey('toh724A')).toBe('toh724a');
    const uuid = '2cd55d9c-a17c-4d9f-9fce-e32e05b0192d';
    expect(normalizeWorkKey(uuid)).toBe(uuid);
  });

  it('serializes objects with sorted keys at every depth', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      '{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}',
    );
  });

  it('accepts the known Tibetan formats', () => {
    expect(parseBundleFormat(undefined)).toEqual({
      ok: true,
      format: { tibetan: 'unicode' },
    });
    expect(parseBundleFormat({ tibetan: 'both' })).toEqual({
      ok: true,
      format: { tibetan: 'both' },
    });
    expect(parseBundleFormat({ tibetan: 'wylie' }).ok).toBe(false);
    expect(parseBundleFormat({ script: 'x' }).ok).toBe(false);
  });
});

describe('Tibetan formats per layer', () => {
  const folios = {
    ...layer('work.folios'),
    tibetanFormats: ['unicode', 'ewts', 'both'] as const,
  };
  const passages = layer('work.passages');
  const draft = { ...layer('work.draft'), prebuilt: true };

  it('refuses only layers that do not write the value', () => {
    expect(unsupportedFormatError([folios], { tibetan: 'ewts' })).toBeNull();
    expect(
      unsupportedFormatError([passages], { tibetan: 'unicode' }),
    ).toBeNull();
    expect(
      unsupportedFormatError([folios, passages, passages], { tibetan: 'both' }),
    ).toBe(
      'format.tibetan "both" is not available for work.passages (writes `unicode`). Request it in a separate bundle with a format it writes, or use "unicode" for the whole bundle.',
    );
  });

  it('lists in discovery which layers write which values', () => {
    const [tibetan] = bundleFormatOptions([folios, passages, draft]);
    expect(tibetan.supported).toEqual(['unicode', 'ewts', 'both']);
    expect(tibetan.description).toContain(
      '`ewts` is written by `work.folios`; `both` is written by `work.folios`.',
    );
    expect(tibetan.description).toContain(
      'Generated layers that write only `unicode` (`work.passages`) refuse any other value',
    );
    expect(tibetan.description).toContain(
      'Prebuilt archives (`work.draft`) keep their own format',
    );
    expect(bundleFormatOptions([passages])[0].supported).toEqual(['unicode']);
  });

  it('gives each layer its formats in describeLayers', () => {
    const described = describeLayers(
      createLayerRegistry({ layers: [folios, passages] }),
    );
    expect(described.map((l) => [l.name, l.tibetanFormats])).toEqual([
      ['work.folios', ['unicode', 'ewts', 'both']],
      ['work.passages', ['unicode']],
    ]);
  });

  it('offers ewts and both for the studio layers through work.folios', () => {
    const [tibetan] = bundleFormatOptions(snapshotLayerRegistry.layers);
    expect(tibetan.supported).toEqual(['unicode', 'ewts', 'both']);
    expect(
      describeLayers(snapshotLayerRegistry).map((l) => [
        l.name,
        l.tibetanFormats,
      ]),
    ).toEqual([
      ['etexts.catalog', ['unicode']],
      ['etexts.text', ['unicode']],
      ['work.annotations', ['unicode']],
      ['work.bibliography', ['unicode']],
      ['work.draft', ['unicode']],
      ['work.folios', ['unicode', 'ewts', 'both']],
      ['work.glossary', ['unicode']],
      ['work.passages', ['unicode']],
      ['work.passages.raw', ['unicode']],
    ]);
  });

  it('says only work.folios writes ewts and both in the studio', () => {
    const [tibetan] = bundleFormatOptions(snapshotLayerRegistry.layers);
    expect(tibetan.description).toContain(
      '`ewts` is written by `work.folios`; `both` is written by `work.folios`.',
    );
    expect(tibetan.description).toContain(
      'Generated layers that write only `unicode` (`work.annotations`, `work.bibliography`, `work.glossary`, `work.passages`, `work.passages.raw`) refuse any other value',
    );
    expect(tibetan.description).toContain(
      'Prebuilt archives (`etexts.catalog`, `etexts.text`, `work.draft`) keep their own format',
    );
  });
});

describe('work.draft', () => {
  it('reports a snapshot store failure as an error resolution', async () => {
    const failing = {
      from: () => {
        throw new Error('db down');
      },
      rpc: () => {
        throw new Error('db down');
      },
    };
    const layer = snapshotLayerRegistry.get('work.draft');
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const resolution = await layer?.resolve(
      {
        client: failing as never,
        format: { tibetan: 'unicode' },
        now: () => 0,
        schedule: () => undefined,
        memo: (_key, load) => load(),
      },
      { work: 'toh8' },
    );
    spy.mockRestore();
    expect(resolution).toMatchObject({ status: 'error' });
  });
});
