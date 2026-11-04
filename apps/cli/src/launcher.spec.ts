/**
 * The launchers skills run eft through (launcher/eft.sh and eft.ps1), against
 * a local server standing in for the GitHub release, with a shell script
 * standing in for the binary.
 */
import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// pwsh takes several seconds to start on a CI runner, and a test that times
// out leaves its launcher running into the next one.
jest.setTimeout(30_000);

const LAUNCHER = join(__dirname, '..', 'launcher');
const VERSION = '2000.1.0';
const PLATFORMS = [
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'linux-arm64',
  'windows-x64',
];
const BINARY = `#!/bin/sh\nprintf 'binary'; printf ' [%s]' "$@"; echo\n`;
const TAMPERED = `#!/bin/sh\necho tampered\n`;
const BUNDLE = `console.log(['bundle', ...process.argv.slice(2)].join(' '));\n`;

const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');
const has = (cmd: string, ...args: string[]) =>
  spawnSync(cmd, args, { stdio: 'ignore' }).status === 0;

/** Each launcher, and the command line that runs it from `scripts`. */
const SHELLS = [
  {
    name: 'eft.sh',
    available: true,
    command: (scripts: string) => ['sh', join(scripts, 'eft.sh')],
  },
  {
    name: 'eft.ps1',
    available: process.platform !== 'win32' && has('pwsh', '-v'),
    command: (scripts: string) => [
      'pwsh',
      '-NoProfile',
      '-NonInteractive',
      '-File',
      join(scripts, 'eft.ps1'),
    ],
  },
];

describe.each(SHELLS)('$name', ({ available, command }) => {
  if (!available) {
    it.skip('needs its shell', () => undefined);
    return;
  }

  let dir: string;
  let server: Server;
  let url: string;
  // What the stand-in release serves, by file name, and what was asked for.
  let release: Map<string, string>;
  let requests: string[];
  let work: string;
  let skill: string;

  const writePins = (platforms: string[]) =>
    writeFileSync(
      join(skill, 'eft-release.txt'),
      [
        '# A comment line.',
        `version=${VERSION}`,
        `url=${url}`,
        ...platforms.map((p) => `${p}=${sha256(BINARY)}`),
      ].join('\n') + '\n',
    );

  const cacheDir = (root = join(work, '84000')) =>
    join(root, 'cache', 'bin', 'eft', VERSION);

  const launch = (
    args: string[],
    env: Record<string, string> = {},
  ): Promise<{ code: number; stdout: string; stderr: string }> =>
    new Promise((resolve) => {
      const [cmd, ...launcher] = command(skill);
      execFile(
        cmd,
        [...launcher, ...args],
        { cwd: work, env: { ...process.env, ...env } },
        (error, stdout, stderr) =>
          resolve({
            code: error ? Number(error.code ?? 1) : 0,
            stdout,
            stderr,
          }),
      );
    });

  beforeAll(async () => {
    server = createServer((req, res) => {
      const name = (req.url ?? '').replace(/^\//, '');
      requests.push(name);
      const body = release.get(name);
      res.writeHead(body === undefined ? 404 : 200);
      res.end(body);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'eft-launcher-'));
    skill = join(dir, 'skill', 'scripts');
    work = join(dir, 'work');
    mkdirSync(skill, { recursive: true });
    mkdirSync(work);
    copyFileSync(join(LAUNCHER, 'eft.sh'), join(skill, 'eft.sh'));
    copyFileSync(join(LAUNCHER, 'eft.ps1'), join(skill, 'eft.ps1'));
    writeFileSync(join(skill, 'eft.mjs'), BUNDLE);
    writePins(PLATFORMS);
    release = new Map(
      PLATFORMS.map((p) => [
        `eft-${p}${p.startsWith('windows') ? '.exe' : ''}`,
        BINARY,
      ]),
    );
    requests = [];
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('downloads, checks and runs the pinned binary, passing arguments through', async () => {
    const run = await launch(['search', 'quotes', 'a b', '']);
    expect(run.stderr).toMatch(/downloading eft 2000\.1\.0/);
    expect(run.stdout).toBe('binary [search] [quotes] [a b] []\n');
    expect(run.code).toBe(0);
    expect(requests).toHaveLength(1);
    expect(readdirSync(cacheDir())).toEqual([requests[0]]);
  });

  it('reuses the cached binary without downloading again', async () => {
    await launch(['--version']);
    const run = await launch(['--version']);
    expect(run).toEqual({
      code: 0,
      stdout: 'binary [--version]\n',
      stderr: '',
    });
    expect(requests).toHaveLength(1);
  });

  it('replaces a cached binary that no longer matches its checksum', async () => {
    await launch([]);
    const cached = join(cacheDir(), requests[0]);
    appendFileSync(cached, 'echo tampered\n');
    const run = await launch(['x']);
    expect(run.stderr).toMatch(/does not match the checksum/);
    expect(run.stdout).toBe('binary [x]\n');
    expect(requests).toHaveLength(2);
  });

  it('refuses a download that does not match its checksum, and runs nothing', async () => {
    for (const name of release.keys()) release.set(name, TAMPERED);
    const run = await launch(['x']);
    expect(run.code).toBe(1);
    expect(run.stderr).toMatch(/refusing to run the downloaded eft-/);
    expect(run.stdout).toBe('');
    expect(readdirSync(cacheDir())).toEqual([]);
  });

  it('runs the bundle with node, and says so, where no binary is pinned', async () => {
    writePins([]);
    const run = await launch(['structure', 'a b']);
    expect(run.stderr).toMatch(
      /no eft binary for \w+-\w+; running the bundled eft\.mjs/,
    );
    expect(run.stdout).toBe('bundle structure a b\n');
    expect(run.code).toBe(0);
    expect(requests).toEqual([]);
  });

  it('runs the bundle with node when the download fails', async () => {
    release.clear();
    const run = await launch(['x']);
    expect(run.stderr).toMatch(/could not download .*; running the bundled/);
    expect(run.stdout).toBe('bundle x\n');
    expect(readdirSync(cacheDir())).toEqual([]);
  });

  it('caches under EFT_84000_ROOT when it is set', async () => {
    const root = join(dir, 'elsewhere');
    const run = await launch(['x'], { EFT_84000_ROOT: root });
    expect(run.stdout).toBe('binary [x]\n');
    expect(readdirSync(cacheDir(root))).toEqual([requests[0]]);
    expect(existsSync(join(work, '84000'))).toBe(false);
  });

  it('fails clearly without its pins', async () => {
    rmSync(join(skill, 'eft-release.txt'));
    const run = await launch(['x']);
    expect(run.code).toBe(1);
    expect(run.stderr).toMatch(/eft-release\.txt is missing/);
  });
});
