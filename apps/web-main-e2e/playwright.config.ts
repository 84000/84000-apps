import { defineConfig, devices } from '@playwright/test';
import {
  BASE_URL,
  GRAPHQL_PORT,
  localStack,
  REPO_ROOT,
  STORAGE_STATE,
  WEB_PORT,
} from './src/support/local-stack';

const { apiUrl, anonKey } = localStack();

/** The app's env, pointed at the local stack whatever `.env.local` says. */
const appEnv = {
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
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
  webServer: [
    {
      command: `npx nx run api-graphql:dev --port=${GRAPHQL_PORT}`,
      cwd: REPO_ROOT,
      url: `http://localhost:${GRAPHQL_PORT}/api/graphql`,
      env: appEnv,
      reuseExistingServer: true,
      timeout: 300_000,
    },
    {
      command: `npx nx run web-main:dev --port=${WEB_PORT}`,
      cwd: REPO_ROOT,
      url: `${BASE_URL}/login`,
      env: appEnv,
      reuseExistingServer: true,
      timeout: 300_000,
    },
  ],
});
