// Opens a signed-in Chromium page on the local studio's editor, for driving
// the judged spec items. Import it from a script you write:
//
//   import { open } from '<skill dir>/scripts/session.mjs';
//   const { page, close } = await open({ toh: 'toh90001', main: 'translation' });
//   ...
//   await close();
//
// It uses the repo's own @playwright/test and the session that the e2e
// suite's `setup` project writes, so run that project first (see SKILL.md).
// It only ever opens http://localhost.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

export const TEST_WORK = 'f09e7249-07a1-496e-8662-665e80f5461c';

const repo =
  process.env.EDITOR_EVAL_REPO ??
  execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
const require = createRequire(path.join(repo, 'package.json'));
const { chromium } = require('@playwright/test');

export const BASE_URL = `http://localhost:${process.env.E2E_WEB_PORT ?? 3804}`;
export const STORAGE_STATE = path.join(
  repo,
  'apps/web-main-e2e/.playwright/auth/editor.json',
);

/**
 * main and right are panel tabs (main: front | translation | compare | source;
 * right: endnotes | abbreviations | comments | ...). hash scrolls the main
 * panel to a passage uuid.
 */
export const open = async ({
  toh = 'toh90001',
  main = 'translation',
  hash,
  right,
  headless = true,
} = {}) => {
  if (!existsSync(STORAGE_STATE)) {
    throw new Error(
      `No signed-in session at ${STORAGE_STATE}. Run the e2e setup project first.`,
    );
  }
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: STORAGE_STATE,
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  const query = new URLSearchParams({
    toh,
    main: ['open', main, hash].filter(Boolean).join(':'),
    right: right ? `open:${right}` : 'closed:endnotes',
  });
  await page.goto(`/translations/editor/${TEST_WORK}?${query}`);
  await page
    .locator('[data-stack-passage]:visible')
    .first()
    .waitFor({ timeout: 120_000 });
  return { browser, context, page, close: () => browser.close() };
};
