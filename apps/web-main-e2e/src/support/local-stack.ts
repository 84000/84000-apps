import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Repo root of this checkout. */
export const REPO_ROOT = path.resolve(__dirname, '../../../..');

/** The test work: toh90001 + toh90002, seeded by infra. */
export const TEST_WORK = {
  uuid: 'f09e7249-07a1-496e-8662-665e80f5461c',
  toh: 'toh90001',
  otherToh: 'toh90002',
} as const;

export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3804);
export const GRAPHQL_PORT = Number(process.env.E2E_GRAPHQL_PORT ?? 3805);
export const BASE_URL = `http://localhost:${WEB_PORT}`;

/** Where the signed-in session is kept between the setup and the tests. */
export const STORAGE_STATE = path.resolve(
  __dirname,
  '../../.playwright/auth/editor.json',
);

/** The seeded account the suite signs in as. */
export const TEST_USER_EMAIL =
  process.env.E2E_USER_EMAIL ?? 'editor@local.test';

export type LocalStack = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * The infra checkout that runs the local Supabase stack. Defaults to an
 * `infra` directory beside this repo; set `E2E_INFRA_DIR` otherwise.
 */
export const infraDir = (): string => {
  const candidates = [
    process.env.E2E_INFRA_DIR,
    path.resolve(REPO_ROOT, '../infra'),
    // An issue worktree sits at <workspace>/workspaces/issues/<id>/repos/.
    path.resolve(REPO_ROOT, '../../../../../infra'),
  ].filter((dir): dir is string => !!dir);
  const found = candidates.find((dir) =>
    existsSync(path.join(dir, 'supabase/config.toml')),
  );
  if (!found) {
    throw new Error(
      `No infra checkout found (tried ${candidates.join(', ')}). Set E2E_INFRA_DIR.`,
    );
  }
  return found;
};

let cached: LocalStack | undefined;

/**
 * Connection details for the running local stack, read from
 * `supabase status`. Refuses anything that is not on this machine, so a
 * test can never write to a hosted project.
 */
export const localStack = (): LocalStack => {
  if (cached) return cached;
  const out = execFileSync('supabase', ['status', '-o', 'env'], {
    cwd: infraDir(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const env = Object.fromEntries(
    out
      .split('\n')
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => [m[1], m[2]]),
  );
  const apiUrl = env['API_URL'];
  if (!apiUrl || !LOCAL_HOSTS.has(new URL(apiUrl).hostname)) {
    throw new Error(`Refusing to run against a non-local Supabase: ${apiUrl}`);
  }
  cached = {
    apiUrl,
    anonKey: env['ANON_KEY'],
    serviceRoleKey: env['SERVICE_ROLE_KEY'],
  };
  return cached;
};

/** The infra script that restores the test work, relative to infra. */
export const RESTORE_SCRIPT = 'scripts/restore-test-work.sh';

/** Put the test work back to its seeded state (infra `make restore-test-work`). */
export const restoreTestWork = (): void => {
  execFileSync(RESTORE_SCRIPT, {
    cwd: infraDir(),
    stdio: ['ignore', 'ignore', 'inherit'],
  });
};
