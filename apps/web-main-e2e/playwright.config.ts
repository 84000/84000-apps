import { defineConfig, devices } from '@playwright/test';
import {
  BASE_URL,
  GRAPHQL_PORT,
  localStack,
  REPO_ROOT,
  STORAGE_STATE,
  WEB_PORT,
} from './src/support/local-stack';

/**
 * The local stack, or undefined when it is not running. Nx loads this file to
 * build its project graph, so it must not throw here; `global-setup.ts`
 * refuses to run the tests instead.
 */
const stack = (() => {
  try {
    return localStack();
  } catch {
    return undefined;
  }
})();

/**
 * Servers already listening on the ports are reused only on request, since
 * the suite cannot tell which Supabase project they were started against.
 */
const reuseExistingServer = process.env.E2E_REUSE_SERVERS === '1';

/** The app's env, pointed at the local stack whatever `.env.local` says. */
const appEnv = stack && {
  NEXT_PUBLIC_SUPABASE_URL: stack.apiUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
  // Server-side clients prefer these over the public ones.
  SUPABASE_URL: stack.apiUrl,
  SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey,
  SUPABASE_SERVICE_KEY: stack.serviceRoleKey,
  NEXT_PUBLIC_GRAPHQL_URL: `http://localhost:${GRAPHQL_PORT}/api/graphql`,
  // The suite targets the passage-stack editor. Overrides apply under
  // `next dev` only, which is why the servers below run in dev mode.
  NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES: 'per-passage-docs',
};

/**
 * Editor checks from docs/editor-spec, run locally against the local
 * Supabase stack. See README.md.
 */
export default defineConfig({
  testDir: './src',
  globalSetup: './src/support/global-setup.ts',
  outputDir: './.playwright/results',
  // The tests share one database and restore it between them.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: './.playwright/report', open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 1000 },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
        storageState: STORAGE_STATE,
        permissions: ['clipboard-read', 'clipboard-write'],
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 1000 },
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },
  ],
  webServer: appEnv && [
    {
      command: `npx nx run api-graphql:dev --port=${GRAPHQL_PORT}`,
      cwd: REPO_ROOT,
      url: `http://localhost:${GRAPHQL_PORT}/api/graphql`,
      env: appEnv,
      reuseExistingServer,
      timeout: 300_000,
    },
    {
      command: `npx nx run web-main:dev --port=${WEB_PORT}`,
      cwd: REPO_ROOT,
      url: `${BASE_URL}/login`,
      env: appEnv,
      reuseExistingServer,
      timeout: 300_000,
    },
  ],
});
