#!/usr/bin/env node
/**
 * Assembles Claude Code plugins from resources spread across the monorepo and
 * writes them into a checkout of the marketplace repo (84000/claude-plugins).
 *
 * Plugins must be self-contained: Claude Code copies a plugin into a cache on
 * install, so anything referenced outside the plugin directory breaks after
 * install. Everything is copied, never symlinked.
 *
 * Usage:
 *   node tools/build-plugins.mjs --target <path-to-claude-plugins-checkout>
 *
 * Exits 0 whether or not anything changed; inspect the `changed` line on stdout
 * (or $GITHUB_OUTPUT when --github-output is passed) to decide about committing.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = join(REPO_ROOT, 'libs', 'lib-agent', 'plugins.json');
// Plugins release on the same cadence as the npm packages, so they carry
// lib-agent's version rather than one invented here.
const VERSION_SOURCE = join(REPO_ROOT, 'libs', 'lib-agent', 'package.json');

// Stand-in written into plugin.json while diffing, so a version bump alone
// never reads as a content change (which would make the bump self-justifying).
const VERSION_PLACEHOLDER = '0.0.0-compare';

// Never ship OS junk. CI builds from a clean checkout, but a local run would
// otherwise copy these in and report a spurious change.
const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db']);

function parseArgs(argv) {
  const args = { target: null, githubOutput: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--target') args.target = argv[++i];
    else if (arg === '--github-output') args.githubOutput = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.target) {
    throw new Error('--target <path-to-claude-plugins-checkout> is required');
  }
  return args;
}

/** Serialize deterministically: 2-space indent, trailing newline, insertion-ordered keys. */
function toJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Read a directory tree into a Map of posix-relative path -> Buffer. */
function readTree(root, prefix = '') {
  const tree = new Map();
  if (!existsSync(root)) return tree;
  for (const entry of readdirSync(root).sort()) {
    if (IGNORED_FILES.has(entry)) continue;
    const abs = join(root, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(abs).isDirectory()) {
      for (const [k, v] of readTree(abs, rel)) tree.set(k, v);
    } else {
      tree.set(rel, readFileSync(abs));
    }
  }
  return tree;
}

function writeTree(root, tree) {
  rmSync(root, { recursive: true, force: true });
  for (const [rel, contents] of tree) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
  }
}

function treesEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [rel, contents] of a) {
    const other = b.get(rel);
    if (!other || !other.equals(contents)) return false;
  }
  return true;
}

/**
 * Replace plugin.json's version with the placeholder so two trees can be
 * compared on content alone.
 */
function normalizeForCompare(tree) {
  const normalized = new Map(tree);
  const manifestPath = '.claude-plugin/plugin.json';
  const manifest = normalized.get(manifestPath);
  if (manifest) {
    const parsed = JSON.parse(manifest.toString('utf-8'));
    parsed.version = VERSION_PLACEHOLDER;
    normalized.set(manifestPath, Buffer.from(toJson(parsed), 'utf-8'));
  }
  return normalized;
}

/**
 * Plugins take lib-agent's version. That library is released in dedicated
 * "Packages vX" commits following the 84000 YYYY.M.X convention, so the bump is
 * already deliberate and human-reviewed — there is nothing for this script to
 * invent, and plugin versions stay legible next to the published packages.
 */
function sourceVersion() {
  const version = JSON.parse(readFileSync(VERSION_SOURCE, 'utf-8')).version;
  if (!version) throw new Error(`No version in ${VERSION_SOURCE}`);
  return version;
}

function readPublishedVersion(pluginDir) {
  const manifestPath = join(pluginDir, '.claude-plugin', 'plugin.json');
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf-8')).version ?? null;
  } catch {
    return null;
  }
}

/** Build one plugin's file tree, with `version` left as the placeholder. */
function buildPluginTree(plugin, defaults) {
  const tree = new Map();

  for (const source of plugin.skills ?? []) {
    const abs = join(REPO_ROOT, source);
    if (!existsSync(abs)) throw new Error(`${plugin.name}: skill source not found: ${source}`);
    for (const [rel, contents] of readTree(abs)) {
      tree.set(`skills/${basename(source)}/${rel}`, contents);
    }
  }

  // Policy excerpts and other material cited by more than one skill are kept in
  // one place in the repo, but a plugin must be self-contained, so each skill
  // that cites them gets its own copy under its `reference/` directory.
  for (const [skill, sources] of Object.entries(plugin.sharedReference ?? {})) {
    if (!(plugin.skills ?? []).some((s) => basename(s) === skill)) {
      throw new Error(
        `${plugin.name}: sharedReference names a skill the plugin does not ship: ${skill}`,
      );
    }
    for (const source of sources) {
      const abs = join(REPO_ROOT, source);
      if (!existsSync(abs))
        throw new Error(
          `${plugin.name}: shared reference source not found: ${source}`,
        );
      for (const [rel, contents] of readTree(abs)) {
        tree.set(`skills/${skill}/reference/${basename(source)}/${rel}`, contents);
      }
    }
  }

  for (const source of plugin.agents ?? []) {
    const abs = join(REPO_ROOT, source);
    if (!existsSync(abs)) throw new Error(`${plugin.name}: agent source not found: ${source}`);
    tree.set(`agents/${basename(source)}`, readFileSync(abs));
  }

  const mcpServers = plugin.mcpServers ?? defaults.mcpServers;
  if (mcpServers && Object.keys(mcpServers).length > 0) {
    tree.set('.mcp.json', Buffer.from(toJson({ mcpServers }), 'utf-8'));
  }

  // `author` is required by `claude plugin validate --strict`.
  tree.set(
    '.claude-plugin/plugin.json',
    Buffer.from(
      toJson({
        name: plugin.name,
        displayName: plugin.displayName,
        description: plugin.description,
        version: VERSION_PLACEHOLDER,
        author: plugin.author ?? defaults.author,
        homepage: plugin.homepage ?? defaults.homepage,
        repository: plugin.repository ?? defaults.repository,
        license: plugin.license ?? defaults.license,
        keywords: plugin.keywords ?? [],
      }),
      'utf-8',
    ),
  );

  return tree;
}

function stampVersion(tree, version) {
  const stamped = new Map(tree);
  const manifestPath = '.claude-plugin/plugin.json';
  const parsed = JSON.parse(stamped.get(manifestPath).toString('utf-8'));
  parsed.version = version;
  stamped.set(manifestPath, Buffer.from(toJson(parsed), 'utf-8'));
  return stamped;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetRoot = resolve(args.target);
  const version = sourceVersion();

  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  const defaults = config.defaults ?? {};

  const publishedPluginsRoot = join(targetRoot, 'plugins');
  const marketplacePath = join(targetRoot, '.claude-plugin', 'marketplace.json');

  const marketplaceEntries = [];
  const results = [];
  let changed = false;

  for (const plugin of config.plugins) {
    const built = buildPluginTree(plugin, defaults);
    const pluginDir = join(publishedPluginsRoot, plugin.name);
    const published = readTree(pluginDir);

    // Compare on content alone. Identical content keeps the published version,
    // so an unchanged plugin is never re-downloaded by installed clients.
    const isNew = published.size === 0;
    const contentChanged = !treesEqual(normalizeForCompare(built), normalizeForCompare(published));

    const publishedVersion = readPublishedVersion(pluginDir);
    let pluginVersion;
    if (isNew || contentChanged) {
      // Shipping changed content under an already-published version means
      // installed clients keep the cached copy and never see the change.
      if (publishedVersion === version) {
        throw new Error(
          `${plugin.name}: content changed but version ${version} is already published. ` +
            'Bump the version in libs/lib-agent/package.json.',
        );
      }
      pluginVersion = version;
      writeTree(pluginDir, stampVersion(built, pluginVersion));
      changed = true;
    } else {
      // Unchanged content keeps its published version even when lib-agent has
      // moved on, so clients do not re-download an untouched plugin.
      pluginVersion = publishedVersion;
    }

    results.push({
      name: plugin.name,
      version: pluginVersion,
      status: isNew ? 'new' : contentChanged ? 'updated' : 'unchanged',
    });

    const entry = {
      name: plugin.name,
      source: `./plugins/${plugin.name}`,
      displayName: plugin.displayName,
      description: plugin.description,
      author: plugin.author ?? defaults.author,
      keywords: plugin.keywords ?? [],
    };
    // `version` is deliberately absent: Claude Code always uses plugin.json's
    // value, so a version here can be silently masked and drift unnoticed.
    if (plugin.renames && Object.keys(plugin.renames).length > 0) {
      entry.renames = plugin.renames;
    }
    marketplaceEntries.push(entry);
  }

  // Drop plugin directories that are no longer configured. Their marketplace
  // entries are gone too, so `renames` (old name -> null) is what keeps
  // existing installs from failing with plugin-not-found.
  const configured = new Set(config.plugins.map((p) => p.name));
  if (existsSync(publishedPluginsRoot)) {
    for (const entry of readdirSync(publishedPluginsRoot)) {
      if (!configured.has(entry) && statSync(join(publishedPluginsRoot, entry)).isDirectory()) {
        rmSync(join(publishedPluginsRoot, entry), { recursive: true, force: true });
        results.push({ name: entry, version: null, status: 'removed' });
        changed = true;
      }
    }
  }

  const marketplace = toJson({
    name: config.marketplace.name,
    description: config.marketplace.description,
    owner: config.marketplace.owner,
    plugins: marketplaceEntries,
  });
  const publishedMarketplace = existsSync(marketplacePath) ? readFileSync(marketplacePath, 'utf-8') : null;
  if (publishedMarketplace !== marketplace) {
    mkdirSync(dirname(marketplacePath), { recursive: true });
    writeFileSync(marketplacePath, marketplace);
    changed = true;
  }

  for (const { name, version, status } of results) {
    console.log(`${status.padEnd(9)} ${name}${version ? ` ${version}` : ''}`);
  }
  console.log(`changed=${changed}`);
  if (args.githubOutput && process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  }
}

main();
