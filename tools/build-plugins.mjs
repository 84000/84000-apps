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

// The database's `app_role` and `app_permission` values. An `audience` naming
// anything else is a typo that would silently never match.
const ROLES = ['admin', 'manager', 'editor', 'translator', 'scholar', 'reader'];
const PERMISSIONS = [
  'projects.read',
  'projects.edit',
  'projects.admin',
  'editor.read',
  'editor.edit',
  'editor.admin',
  'harness.read',
  'harness.edit',
  'harness.admin',
];

/**
 * Check a plugin's `audience`: `{ everyone: true }`, or the `roles` and/or
 * `permissions` it suits. Every plugin needs one, so onboarding can place it.
 */
function validateAudience(plugin) {
  const audience = plugin.audience;
  if (!audience || typeof audience !== 'object') {
    throw new Error(`${plugin.name}: audience is required`);
  }
  const { everyone, roles = [], permissions = [], ...rest } = audience;
  if (Object.keys(rest).length > 0) {
    throw new Error(`${plugin.name}: unknown audience keys: ${Object.keys(rest).join(', ')}`);
  }
  if (everyone !== undefined && everyone !== true) {
    throw new Error(`${plugin.name}: audience.everyone must be true when set`);
  }
  const badRoles = roles.filter((r) => !ROLES.includes(r));
  const badPermissions = permissions.filter((p) => !PERMISSIONS.includes(p));
  if (badRoles.length > 0 || badPermissions.length > 0) {
    throw new Error(
      `${plugin.name}: unknown audience values: ${[...badRoles, ...badPermissions].join(', ')}`,
    );
  }
  if (!everyone && roles.length === 0 && permissions.length === 0) {
    throw new Error(`${plugin.name}: audience names no one`);
  }
}

const code = (values) => values.map((v) => `\`${v}\``).join(', ');

/**
 * The plugin catalog the onboarding skill recommends from, rendered from every
 * plugin's `audience` so the mapping is never written by hand.
 */
function renderPluginCatalog(plugins) {
  const lines = [
    '# The 84000 plugins and who they suit',
    '',
    '<!-- Generated by tools/build-plugins.mjs from libs/lib-agent/plugins.json. Do not edit. -->',
    '',
    'Recommend a plugin when the user\'s role is one of its roles, or when they hold any one of its permissions. A plugin for everyone suits every user.',
    '',
    'A plugin is installed when its skills or agents are available to you. They may appear with the plugin name as a prefix, as in `84000-core:send-feedback`.',
  ];
  for (const plugin of plugins) {
    const { everyone, roles = [], permissions = [] } = plugin.audience;
    const suits = everyone
      ? 'everyone'
      : [
          roles.length > 0 ? `roles ${code(roles)}` : null,
          permissions.length > 0 ? `permissions ${code(permissions)}` : null,
        ]
          .filter(Boolean)
          .join('; or ');
    const components = [
      ...(plugin.skills ?? []).map((s) => basename(s)),
      ...(plugin.agents ?? []).map((a) => basename(a, '.md')),
    ];
    lines.push(
      '',
      `## ${plugin.displayName} (\`${plugin.name}\`)`,
      '',
      plugin.description,
      '',
      `- **Suits:** ${suits}`,
      `- **Installed if you can see:** ${components.length > 0 ? code(components) : 'nothing to detect; ask the user'}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

/** Build one plugin's file tree, with `version` left as the placeholder. */
function buildPluginTree(plugin, defaults, allPlugins) {
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

  // The onboarding skill's recommendations, generated rather than hand-written
  // so they cannot drift from the plugins actually configured.
  for (const skill of plugin.pluginCatalog ?? []) {
    if (!(plugin.skills ?? []).some((s) => basename(s) === skill)) {
      throw new Error(
        `${plugin.name}: pluginCatalog names a skill the plugin does not ship: ${skill}`,
      );
    }
    tree.set(
      `skills/${skill}/reference/plugins.md`,
      Buffer.from(renderPluginCatalog(allPlugins), 'utf-8'),
    );
  }

  // Hooks: a directory holding hooks.json and the scripts it runs, copied to
  // the plugin's hooks/ where Claude Code looks for hooks/hooks.json.
  if (plugin.hooks) {
    const abs = join(REPO_ROOT, plugin.hooks);
    const manifest = join(abs, 'hooks.json');
    if (!existsSync(manifest)) {
      throw new Error(`${plugin.name}: hooks source has no hooks.json: ${plugin.hooks}`);
    }
    const parsed = JSON.parse(readFileSync(manifest, 'utf-8'));
    if (!parsed.hooks || typeof parsed.hooks !== 'object') {
      throw new Error(`${plugin.name}: hooks.json needs a top-level "hooks" object`);
    }
    const hookFiles = readTree(abs);
    for (const [rel, contents] of hookFiles) {
      tree.set(`hooks/${rel}`, contents);
    }
    // A script that hooks.json names but the tree lacks fails silently at run
    // time, and `claude plugin validate` does not look.
    for (const [, path] of JSON.stringify(parsed).matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/([^\s"\\]+)/g)) {
      if (!hookFiles.has(path)) {
        throw new Error(`${plugin.name}: hooks.json runs hooks/${path}, which is not in ${plugin.hooks}`);
      }
    }
  }

  // Slash commands: one markdown file each, copied to the plugin's commands/.
  const commandNames = new Set();
  for (const source of plugin.commands ?? []) {
    const abs = join(REPO_ROOT, source);
    if (!existsSync(abs)) throw new Error(`${plugin.name}: command source not found: ${source}`);
    if (!source.endsWith('.md')) {
      throw new Error(`${plugin.name}: command source must be a .md file: ${source}`);
    }
    if (commandNames.has(basename(source))) {
      throw new Error(`${plugin.name}: two commands are named ${basename(source)}`);
    }
    commandNames.add(basename(source));
    tree.set(`commands/${basename(source)}`, readFileSync(abs));
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

  for (const plugin of config.plugins) validateAudience(plugin);

  for (const plugin of config.plugins) {
    const built = buildPluginTree(plugin, defaults, config.plugins);
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
