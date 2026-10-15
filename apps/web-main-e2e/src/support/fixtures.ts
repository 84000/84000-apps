import { test as base } from '@playwright/test';
import { restoreTestWork } from './local-stack';

/**
 * The suite's `test`: every test starts from the seeded test work, and the
 * work is put back once the run ends.
 */
export const test = base.extend<{ seededWork: void }>({
  seededWork: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      restoreTestWork();
      await use();
    },
    { auto: true },
  ],
});

test.afterAll(() => restoreTestWork());

export { expect } from '@playwright/test';
